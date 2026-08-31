import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

const _cols = 10;
const _rows = 20;

class _PieceDef {
  const _PieceDef(this.shape, this.color);
  final List<List<int>> shape;
  final Color color;
}

final _pieces = [
  _PieceDef([
    [1, 1, 1, 1],
  ], const Color(0xFF06B6D4)),
  _PieceDef([
    [1, 1],
    [1, 1],
  ], const Color(0xFFEAB308)),
  _PieceDef([
    [0, 1, 0],
    [1, 1, 1],
  ], const Color(0xFFA855F7)),
  _PieceDef([
    [0, 1, 1],
    [1, 1, 0],
  ], const Color(0xFF22C55E)),
  _PieceDef([
    [1, 1, 0],
    [0, 1, 1],
  ], const Color(0xFFEF4444)),
  _PieceDef([
    [1, 0, 0],
    [1, 1, 1],
  ], const Color(0xFF3B82F6)),
  _PieceDef([
    [0, 0, 1],
    [1, 1, 1],
  ], const Color(0xFFF97316)),
];

class _Piece {
  _Piece(this.shape, this.color, this.x, this.y);
  List<List<int>> shape;
  final Color color;
  int x;
  int y;
}

_Piece _randPiece() {
  final p = _pieces[Random().nextInt(_pieces.length)];
  final shape = p.shape.map((r) => [...r]).toList();
  return _Piece(shape, p.color, (_cols ~/ 2) - (shape[0].length ~/ 2), 0);
}

List<List<int>> _rotate90(List<List<int>> shape) {
  final rows = shape.length, cols = shape[0].length;
  return List.generate(cols, (c) => List.generate(rows, (r) => shape[rows - 1 - r][c]));
}

bool _valid(List<List<Color?>> board, _Piece piece, {int dx = 0, int dy = 0, List<List<int>>? shape}) {
  final s = shape ?? piece.shape;
  for (var r = 0; r < s.length; r++) {
    for (var c = 0; c < s[r].length; c++) {
      if (s[r][c] == 0) continue;
      final nx = piece.x + c + dx;
      final ny = piece.y + r + dy;
      if (nx < 0 || nx >= _cols || ny < 0 || ny >= _rows) return false;
      if (board[ny][nx] != null) return false;
    }
  }
  return true;
}

class TetrisGame extends StatefulWidget {
  const TetrisGame({super.key});
  @override
  State<TetrisGame> createState() => _TetrisGameState();
}

class _TetrisGameState extends State<TetrisGame> {
  List<List<Color?>> _board = List.generate(_rows, (_) => List<Color?>.filled(_cols, null));
  _Piece? _piece;
  int _score = 0;
  int _lines = 0;
  bool _started = false;
  bool _gameOver = false;
  bool _paused = false;
  Timer? _timer;
  final _focusNode = FocusNode();

  @override
  void dispose() {
    _timer?.cancel();
    _focusNode.dispose();
    super.dispose();
  }

  void _start() {
    _timer?.cancel();
    setState(() {
      _board = List.generate(_rows, (_) => List<Color?>.filled(_cols, null));
      _piece = _randPiece();
      _score = 0;
      _lines = 0;
      _started = true;
      _gameOver = false;
      _paused = false;
    });
    _timer = Timer.periodic(const Duration(milliseconds: 400), (_) => _tick());
    _focusNode.requestFocus();
  }

  void _tick() {
    if (_paused || _piece == null) return;
    if (_valid(_board, _piece!, dy: 1)) {
      setState(() => _piece!.y++);
    } else {
      _lock();
    }
  }

  void _lock() {
    final p = _piece;
    if (p == null) return;
    for (var r = 0; r < p.shape.length; r++) {
      for (var c = 0; c < p.shape[r].length; c++) {
        if (p.shape[r][c] != 0) _board[p.y + r][p.x + c] = p.color;
      }
    }
    var cleared = 0;
    _board = _board.where((row) {
      if (row.every((c) => c != null)) {
        cleared++;
        return false;
      }
      return true;
    }).toList();
    while (_board.length < _rows) {
      _board.insert(0, List<Color?>.filled(_cols, null));
    }
    const pts = [0, 100, 300, 500, 800];
    setState(() {
      _score += pts[cleared.clamp(0, 4)];
      _lines += cleared;
      _piece = _randPiece();
    });
    if (!_valid(_board, _piece!)) {
      _timer?.cancel();
      setState(() => _gameOver = true);
    }
  }

  void _move(int dx) {
    if (_piece == null || _gameOver || _paused) return;
    if (_valid(_board, _piece!, dx: dx)) setState(() => _piece!.x += dx);
  }

  void _softDrop() {
    if (_piece == null || _gameOver || _paused) return;
    if (_valid(_board, _piece!, dy: 1)) {
      setState(() => _piece!.y++);
    } else {
      _lock();
    }
  }

  void _rotate() {
    if (_piece == null || _gameOver || _paused) return;
    final rot = _rotate90(_piece!.shape);
    if (_valid(_board, _piece!, shape: rot)) setState(() => _piece!.shape = rot);
  }

  void _hardDrop() {
    if (_piece == null || _gameOver || _paused) return;
    while (_valid(_board, _piece!, dy: 1)) {
      _piece!.y++;
    }
    _lock();
  }

  void _togglePause() {
    if (!_started || _gameOver) return;
    setState(() => _paused = !_paused);
  }

  void _onKey(KeyEvent event) {
    if (event is! KeyDownEvent) return;
    switch (event.logicalKey) {
      case LogicalKeyboardKey.arrowLeft:
        _move(-1);
      case LogicalKeyboardKey.arrowRight:
        _move(1);
      case LogicalKeyboardKey.arrowDown:
        _softDrop();
      case LogicalKeyboardKey.arrowUp:
        _rotate();
      case LogicalKeyboardKey.space:
        _hardDrop();
      case LogicalKeyboardKey.keyP:
        _togglePause();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Column(children: [const Text('SCORE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.grey)), Text('$_score', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900))]),
            const SizedBox(width: 24),
            Column(children: [const Text('LINES', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.grey)), Text('$_lines', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900))]),
            if (_started && !_gameOver) ...[const SizedBox(width: 16), OutlinedButton(onPressed: _togglePause, child: Text(_paused ? 'Resume' : 'Pause'))],
          ],
        ),
        const SizedBox(height: 12),
        Focus(
          focusNode: _focusNode,
          autofocus: true,
          onKeyEvent: (node, event) {
            _onKey(event);
            return KeyEventResult.handled;
          },
          child: GestureDetector(
            onTapDown: (_) => _focusNode.requestFocus(),
            child: Stack(
              alignment: Alignment.center,
              children: [
                AspectRatio(
                  aspectRatio: _cols / _rows,
                  child: LayoutBuilder(
                    builder: (context, constraints) => CustomPaint(
                      size: Size(constraints.maxWidth, constraints.maxHeight),
                      painter: _TetrisPainter(board: _board, piece: _piece),
                    ),
                  ),
                ),
                if (_paused) Container(color: Colors.black.withValues(alpha: 0.6), child: const Center(child: Text('PAUSED', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 20, letterSpacing: 2)))),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        if (!_started || _gameOver) ...[
          if (_gameOver) const Padding(padding: EdgeInsets.only(bottom: 8), child: Text('Game Over!', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w900))),
          ElevatedButton(onPressed: _start, child: Text(_gameOver ? 'Restart' : 'Start Game')),
        ],
        if (_started && !_gameOver) ...[
          const SizedBox(height: 12),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            _padBtn(Icons.arrow_left, () => _move(-1)),
            _padBtn(Icons.rotate_right, _rotate),
            _padBtn(Icons.arrow_right, () => _move(1)),
            _padBtn(Icons.arrow_downward, _softDrop),
            _padBtn(Icons.keyboard_double_arrow_down, _hardDrop, primary: true),
          ]),
        ],
        const SizedBox(height: 8),
        const Text('← → 이동 · ↑ 회전 · ↓ 소프트드롭 · Space 하드드롭 · P 일시정지', style: TextStyle(fontSize: 10, color: Colors.grey), textAlign: TextAlign.center),
      ],
    );
  }

  Widget _padBtn(IconData icon, VoidCallback onTap, {bool primary = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(color: primary ? Theme.of(context).colorScheme.primary : Colors.grey.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),
          child: Icon(icon, color: primary ? Colors.white : null),
        ),
      ),
    );
  }
}

class _TetrisPainter extends CustomPainter {
  _TetrisPainter({required this.board, required this.piece});
  final List<List<Color?>> board;
  final _Piece? piece;

  @override
  void paint(Canvas canvas, Size size) {
    final cell = size.width / _cols;
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), Paint()..color = const Color(0xFF0A0A0A));

    final gridPaint = Paint()
      ..color = const Color(0xFF1C1C1C)
      ..strokeWidth = 0.5;
    for (var c = 0; c <= _cols; c++) {
      canvas.drawLine(Offset(c * cell, 0), Offset(c * cell, size.height), gridPaint);
    }
    for (var r = 0; r <= _rows; r++) {
      canvas.drawLine(Offset(0, r * cell), Offset(size.width, r * cell), gridPaint);
    }

    void drawBlock(int c, int r, Color color) {
      final rect = RRect.fromRectAndRadius(Rect.fromLTWH(c * cell + 1, r * cell + 1, cell - 2, cell - 2), const Radius.circular(3));
      canvas.drawRRect(rect, Paint()..color = color);
      final highlight = RRect.fromRectAndRadius(Rect.fromLTWH(c * cell + 2, r * cell + 2, cell - 4, 6), const Radius.circular(2));
      canvas.drawRRect(highlight, Paint()..color = Colors.white.withValues(alpha: 0.15));
    }

    for (var r = 0; r < _rows; r++) {
      for (var c = 0; c < _cols; c++) {
        final color = board[r][c];
        if (color != null) drawBlock(c, r, color);
      }
    }

    final p = piece;
    if (p != null) {
      var ghostY = p.y;
      while (_valid(board, p, dy: ghostY - p.y + 1)) {
        ghostY++;
      }
      if (ghostY != p.y) {
        for (var r = 0; r < p.shape.length; r++) {
          for (var c = 0; c < p.shape[r].length; c++) {
            if (p.shape[r][c] == 0) continue;
            final rect = RRect.fromRectAndRadius(Rect.fromLTWH((p.x + c) * cell + 1, (ghostY + r) * cell + 1, cell - 2, cell - 2), const Radius.circular(3));
            canvas.drawRRect(rect, Paint()..color = Colors.white.withValues(alpha: 0.08));
          }
        }
      }
      for (var r = 0; r < p.shape.length; r++) {
        for (var c = 0; c < p.shape[r].length; c++) {
          if (p.shape[r][c] == 0) continue;
          drawBlock(p.x + c, p.y + r, p.color);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _TetrisPainter oldDelegate) => true;
}
