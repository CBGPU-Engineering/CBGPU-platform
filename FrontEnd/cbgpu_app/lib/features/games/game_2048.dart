import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

typedef _Grid = List<List<int?>>;

_Grid _emptyGrid() => List.generate(4, (_) => List<int?>.filled(4, null));

_Grid _addRandom(_Grid g) {
  final empty = <(int, int)>[];
  for (var r = 0; r < 4; r++) {
    for (var c = 0; c < 4; c++) {
      if (g[r][c] == null) empty.add((r, c));
    }
  }
  if (empty.isEmpty) return g;
  final (r, c) = empty[Random().nextInt(empty.length)];
  final next = g.map((row) => [...row]).toList();
  next[r][c] = Random().nextDouble() < 0.9 ? 2 : 4;
  return next;
}

_Grid _createGrid() => _addRandom(_addRandom(_emptyGrid()));

({List<int?> row, int score}) _slideRow(List<int?> row) {
  final vals = row.whereType<int>().toList();
  var score = 0;
  final merged = <int?>[];
  var i = 0;
  while (i < vals.length) {
    if (i + 1 < vals.length && vals[i] == vals[i + 1]) {
      merged.add(vals[i] * 2);
      score += vals[i] * 2;
      i += 2;
    } else {
      merged.add(vals[i]);
      i++;
    }
  }
  while (merged.length < 4) {
    merged.add(null);
  }
  return (row: merged, score: score);
}

_Grid _transpose(_Grid m) => List.generate(4, (c) => List.generate(4, (r) => m[r][c]));

({_Grid grid, int score}) _applyMove(_Grid g, String dir) {
  var score = 0;
  var grid = g.map((row) => [...row]).toList();
  switch (dir) {
    case 'left':
      grid = grid.map((row) {
        final r = _slideRow(row);
        score += r.score;
        return r.row;
      }).toList();
    case 'right':
      grid = grid.map((row) {
        final r = _slideRow(row.reversed.toList());
        score += r.score;
        return r.row.reversed.toList();
      }).toList();
    case 'up':
      grid = _transpose(_transpose(grid).map((row) {
        final r = _slideRow(row);
        score += r.score;
        return r.row;
      }).toList());
    default:
      grid = _transpose(_transpose(grid).map((row) {
        final r = _slideRow(row.reversed.toList());
        score += r.score;
        return r.row.reversed.toList();
      }).toList());
  }
  return (grid: grid, score: score);
}

bool _gridsEqual(_Grid a, _Grid b) {
  for (var r = 0; r < 4; r++) {
    for (var c = 0; c < 4; c++) {
      if (a[r][c] != b[r][c]) return false;
    }
  }
  return true;
}

bool _isOver(_Grid g) {
  for (var r = 0; r < 4; r++) {
    for (var c = 0; c < 4; c++) {
      if (g[r][c] == null) return false;
      if (c < 3 && g[r][c] == g[r][c + 1]) return false;
      if (r < 3 && g[r][c] == g[r + 1][c]) return false;
    }
  }
  return true;
}

const _colors = {
  2: (Color(0xFFFDE68A), Colors.black87),
  4: (Color(0xFFFCD34D), Colors.black87),
  8: (Color(0xFFFDBA74), Colors.white),
  16: (Color(0xFFFB923C), Colors.white),
  32: (Color(0xFFF97316), Colors.white),
  64: (Color(0xFFEF4444), Colors.white),
  128: (Color(0xFFFACC15), Colors.white),
  256: (Color(0xFFEAB308), Colors.white),
  512: (Color(0xFF22C55E), Colors.white),
  1024: (Color(0xFF16A34A), Colors.white),
  2048: (Color(0xFF15803D), Colors.white),
};

class Game2048 extends StatefulWidget {
  const Game2048({super.key});
  @override
  State<Game2048> createState() => _Game2048State();
}

class _Game2048State extends State<Game2048> {
  _Grid _grid = _createGrid();
  int _score = 0;
  int _best = 0;
  bool _over = false;
  bool _won = false;
  final _focusNode = FocusNode();
  Offset? _swipeStart;
  Offset? _swipeEnd;

  void _reset() {
    setState(() {
      _grid = _createGrid();
      _score = 0;
      _over = false;
      _won = false;
    });
  }

  void _move(String dir) {
    if (_over) return;
    final result = _applyMove(_grid, dir);
    if (_gridsEqual(result.grid, _grid)) return;
    final next = _addRandom(result.grid);
    setState(() {
      _grid = next;
      _score += result.score;
      if (_score > _best) _best = _score;
      if (!_won && next.expand((r) => r).contains(2048)) _won = true;
      if (_isOver(next)) _over = true;
    });
  }

  void _onKey(KeyEvent event) {
    if (event is! KeyDownEvent) return;
    switch (event.logicalKey) {
      case LogicalKeyboardKey.arrowLeft:
        _move('left');
      case LogicalKeyboardKey.arrowRight:
        _move('right');
      case LogicalKeyboardKey.arrowUp:
        _move('up');
      case LogicalKeyboardKey.arrowDown:
        _move('down');
    }
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _statBox('SCORE', '$_score'),
            const SizedBox(width: 12),
            _statBox('BEST', '$_best'),
            const SizedBox(width: 12),
            OutlinedButton(onPressed: _reset, child: const Text('New Game')),
          ],
        ),
        const SizedBox(height: 16),
        Focus(
          focusNode: _focusNode,
          autofocus: true,
          onKeyEvent: (node, event) {
            _onKey(event);
            return KeyEventResult.handled;
          },
          child: GestureDetector(
            onTapDown: (_) => _focusNode.requestFocus(),
            onPanStart: (d) => _swipeStart = d.globalPosition,
            onPanUpdate: (d) => _swipeEnd = d.globalPosition,
            onPanEnd: (_) {
              final start = _swipeStart;
              final end = _swipeEnd;
              if (start == null || end == null) return;
              final delta = end - start;
              if (delta.distance < 24) return;
              if (delta.dx.abs() > delta.dy.abs()) {
                _move(delta.dx > 0 ? 'right' : 'left');
              } else {
                _move(delta.dy > 0 ? 'down' : 'up');
              }
            },
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Colors.grey.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(16)),
              child: AspectRatio(
                aspectRatio: 1,
                child: GridView.builder(
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 4, crossAxisSpacing: 8, mainAxisSpacing: 8),
                  itemCount: 16,
                  itemBuilder: (context, i) {
                    final v = _grid[i ~/ 4][i % 4];
                    final colorPair = v != null ? _colors[v] : null;
                    return Container(
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: colorPair?.$1 ?? Colors.grey.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
                      child: Text(v?.toString() ?? '', style: TextStyle(fontWeight: FontWeight.w900, fontSize: v != null && v >= 1024 ? 16 : 20, color: colorPair?.$2 ?? Colors.black)),
                    );
                  },
                ),
              ),
            ),
          ),
        ),
        if (_won && !_over) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(color: Colors.green.withValues(alpha: 0.1), border: Border.all(color: Colors.green.withValues(alpha: 0.3)), borderRadius: BorderRadius.circular(12)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Text('You reached 2048!', style: TextStyle(color: Colors.green, fontWeight: FontWeight.w900, fontSize: 12)),
              const SizedBox(width: 8),
              TextButton(onPressed: () => setState(() => _won = false), child: const Text('Keep going', style: TextStyle(fontSize: 11))),
            ]),
          ),
        ],
        if (_over) ...[
          const SizedBox(height: 12),
          const Text('Game Over!', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          ElevatedButton(onPressed: _reset, child: const Text('Restart')),
        ],
        const SizedBox(height: 8),
        const Text('화살표 또는 스와이프로 타일 밀기 · 2048을 만들어보세요!', style: TextStyle(fontSize: 11, color: Colors.grey)),
      ],
    );
  }

  Widget _statBox(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(color: Colors.grey.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
      child: Column(children: [Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.grey)), Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900))]),
    );
  }
}
