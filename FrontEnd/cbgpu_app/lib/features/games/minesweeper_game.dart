import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';

class _Level {
  const _Level(this.rows, this.cols, this.mines, this.label);
  final int rows, cols, mines;
  final String label;
}

const _levels = {'easy': _Level(9, 9, 10, 'easy'), 'medium': _Level(12, 12, 24, 'medium'), 'hard': _Level(14, 16, 40, 'hard')};

class _Cell {
  bool mine = false;
  bool revealed = false;
  bool flagged = false;
  int adj = 0;
}

typedef _Grid = List<List<_Cell>>;

_Grid _makeGrid(int rows, int cols) => List.generate(rows, (_) => List.generate(cols, (_) => _Cell()));

_Grid _placeMines(_Grid grid, int rows, int cols, int mines, int safeR, int safeC) {
  final rand = Random();
  var placed = 0;
  while (placed < mines) {
    final r = rand.nextInt(rows);
    final c = rand.nextInt(cols);
    if (grid[r][c].mine) continue;
    if ((r - safeR).abs() > 1 || (c - safeC).abs() > 1) {
      grid[r][c].mine = true;
      placed++;
    }
  }
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      if (grid[r][c].mine) continue;
      var cnt = 0;
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          final nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].mine) cnt++;
        }
      }
      grid[r][c].adj = cnt;
    }
  }
  return grid;
}

void _flood(_Grid g, int r, int c, int rows, int cols) {
  final queue = <(int, int)>[(r, c)];
  while (queue.isNotEmpty) {
    final (cr, cc) = queue.removeAt(0);
    if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) continue;
    final cell = g[cr][cc];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    if (cell.adj == 0) {
      for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
          if (dr != 0 || dc != 0) queue.add((cr + dr, cc + dc));
        }
      }
    }
  }
}

const _adjColors = [
  Colors.transparent,
  Color(0xFF3B82F6),
  Color(0xFF22C55E),
  Color(0xFFEF4444),
  Color(0xFF8B5CF6),
  Color(0xFFF97316),
  Color(0xFF06B6D4),
  Color(0xFFE11D48),
  Color(0xFF6B7280),
];

class MinesweeperGame extends StatefulWidget {
  const MinesweeperGame({super.key});
  @override
  State<MinesweeperGame> createState() => _MinesweeperGameState();
}

class _MinesweeperGameState extends State<MinesweeperGame> {
  String _level = 'easy';
  late _Grid _grid = _makeGrid(_cfg.rows, _cfg.cols);
  String _phase = 'idle'; // idle, playing, won, lost
  bool _flagMode = false;
  int _flags = 0;
  int _time = 0;
  bool _firstClick = true;
  Timer? _timer;

  _Level get _cfg => _levels[_level]!;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _reset([String? lv]) {
    _timer?.cancel();
    setState(() {
      if (lv != null) _level = lv;
      _grid = _makeGrid(_cfg.rows, _cfg.cols);
      _phase = 'idle';
      _flags = 0;
      _time = 0;
      _firstClick = true;
      _flagMode = false;
    });
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _time++);
    });
  }

  void _reveal(int r, int c) {
    if (_phase == 'won' || _phase == 'lost') return;
    if (_firstClick) {
      setState(() {
        _grid = _placeMines(_makeGrid(_cfg.rows, _cfg.cols), _cfg.rows, _cfg.cols, _cfg.mines, r, c);
        _firstClick = false;
        _phase = 'playing';
      });
      _startTimer();
    }
    final cell = _grid[r][c];
    if (cell.revealed || cell.flagged) return;
    if (cell.mine) {
      setState(() {
        for (final row in _grid) {
          for (final cl in row) {
            if (cl.mine) cl.revealed = true;
          }
        }
        _phase = 'lost';
      });
      _timer?.cancel();
      return;
    }
    setState(() {
      _flood(_grid, r, c, _cfg.rows, _cfg.cols);
      final unrevealed = _grid.expand((row) => row).where((cl) => !cl.mine && !cl.revealed).length;
      if (unrevealed == 0) {
        _phase = 'won';
        _timer?.cancel();
      }
    });
  }

  void _flag(int r, int c) {
    if (_phase == 'won' || _phase == 'lost') return;
    final cell = _grid[r][c];
    if (cell.revealed) return;
    setState(() {
      cell.flagged = !cell.flagged;
      _flags += cell.flagged ? 1 : -1;
    });
  }

  void _handleTap(int r, int c) {
    if (_flagMode) {
      _flag(r, c);
    } else {
      _reveal(r, c);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final lv in _levels.keys) ChoiceChip(label: Text(lv, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)), selected: _level == lv, onSelected: (_) => _reset(lv)),
            Text('💣 ${_cfg.mines - _flags}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.grey)),
            Text('⏱ ${_time}s', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.grey)),
            OutlinedButton(onPressed: () => _reset(), child: const Text('Reset')),
          ],
        ),
        const SizedBox(height: 8),
        ChoiceChip(
          label: Text(_flagMode ? '🚩 깃발 모드 ON' : '👆 클릭 모드', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
          selected: _flagMode,
          selectedColor: Colors.amber.withValues(alpha: 0.3),
          onSelected: (_) => setState(() => _flagMode = !_flagMode),
        ),
        const SizedBox(height: 16),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: AspectRatio(
            aspectRatio: _cfg.cols / _cfg.rows,
            child: GridView.builder(
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: _cfg.cols),
              itemCount: _cfg.rows * _cfg.cols,
              itemBuilder: (context, i) {
                final r = i ~/ _cfg.cols, c = i % _cfg.cols;
                final cell = _grid[r][c];
                Color bg = Colors.grey.withValues(alpha: 0.15);
                if (cell.revealed) bg = cell.mine ? Colors.red.withValues(alpha: 0.7) : Colors.grey.withValues(alpha: 0.05);
                return GestureDetector(
                  onTap: () => _handleTap(r, c),
                  onLongPress: () => _flag(r, c),
                  child: Container(
                    margin: const EdgeInsets.all(0.5),
                    decoration: BoxDecoration(color: bg, border: Border.all(color: Colors.grey.withValues(alpha: 0.15))),
                    alignment: Alignment.center,
                    child: cell.flagged && !cell.revealed
                        ? const Text('🚩', style: TextStyle(fontSize: 12))
                        : (cell.revealed && cell.mine)
                            ? const Text('💣', style: TextStyle(fontSize: 12))
                            : (cell.revealed && cell.adj > 0)
                                ? Text('${cell.adj}', style: TextStyle(color: _adjColors[cell.adj], fontWeight: FontWeight.w900, fontSize: 11))
                                : null,
                  ),
                );
              },
            ),
          ),
        ),
        if (_phase == 'won' || _phase == 'lost') ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: (_phase == 'won' ? Colors.green : Colors.red).withValues(alpha: 0.1),
              border: Border.all(color: (_phase == 'won' ? Colors.green : Colors.red).withValues(alpha: 0.3)),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(_phase == 'won' ? '🎉 클리어!' : '💥 폭발!', style: TextStyle(color: _phase == 'won' ? Colors.green : Colors.red, fontWeight: FontWeight.w900, fontSize: 16)),
              Text('$_time초', style: const TextStyle(fontSize: 11, color: Colors.grey)),
              const SizedBox(height: 8),
              ElevatedButton(onPressed: () => _reset(), child: const Text('다시 하기')),
            ]),
          ),
        ],
        const SizedBox(height: 8),
        const Text('탭=열기 · 길게 눌러/깃발모드=깃발 · 숫자=인접 지뢰 수', style: TextStyle(fontSize: 10, color: Colors.grey), textAlign: TextAlign.center),
      ],
    );
  }
}
