import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

const _cols = 20;
const _rows = 20;

enum _Dir { up, down, left, right }

_Dir _opposite(_Dir d) => switch (d) {
      _Dir.up => _Dir.down,
      _Dir.down => _Dir.up,
      _Dir.left => _Dir.right,
      _Dir.right => _Dir.left,
    };

class SnakeGame extends StatefulWidget {
  const SnakeGame({super.key});
  @override
  State<SnakeGame> createState() => _SnakeGameState();
}

class _SnakeGameState extends State<SnakeGame> {
  List<Point<int>> _snake = [const Point(10, 10)];
  _Dir _dir = _Dir.right;
  _Dir _nextDir = _Dir.right;
  Point<int> _food = const Point(5, 5);
  int _score = 0;
  bool _started = false;
  bool _gameOver = false;
  Timer? _timer;
  final _focusNode = FocusNode();
  Offset? _swipeStart;
  Offset? _swipeEnd;

  @override
  void dispose() {
    _timer?.cancel();
    _focusNode.dispose();
    super.dispose();
  }

  Point<int> _randFood() {
    final rand = Random();
    Point<int> p;
    do {
      p = Point(rand.nextInt(_cols), rand.nextInt(_rows));
    } while (_snake.contains(p));
    return p;
  }

  void _start() {
    _timer?.cancel();
    setState(() {
      _snake = [const Point(10, 10)];
      _dir = _Dir.right;
      _nextDir = _Dir.right;
      _food = _randFood();
      _score = 0;
      _started = true;
      _gameOver = false;
    });
    _timer = Timer.periodic(const Duration(milliseconds: 110), (_) => _tick());
    _focusNode.requestFocus();
  }

  void _tick() {
    _dir = _nextDir;
    final head = _snake.first;
    final delta = switch (_dir) {
      _Dir.up => const Point(0, -1),
      _Dir.down => const Point(0, 1),
      _Dir.left => const Point(-1, 0),
      _Dir.right => const Point(1, 0),
    };
    final nh = Point(head.x + delta.x, head.y + delta.y);
    if (nh.x < 0 || nh.x >= _cols || nh.y < 0 || nh.y >= _rows || _snake.contains(nh)) {
      _timer?.cancel();
      setState(() => _gameOver = true);
      return;
    }
    setState(() {
      final ate = nh == _food;
      _snake = [nh, ..._snake];
      if (!ate) {
        _snake.removeLast();
      } else {
        _food = _randFood();
        _score++;
      }
    });
  }

  void _setDir(_Dir d) {
    if (_dir != _opposite(d)) _nextDir = d;
  }

  void _onKey(KeyEvent event) {
    if (event is! KeyDownEvent) return;
    switch (event.logicalKey) {
      case LogicalKeyboardKey.arrowUp || LogicalKeyboardKey.keyW:
        _setDir(_Dir.up);
      case LogicalKeyboardKey.arrowDown || LogicalKeyboardKey.keyS:
        _setDir(_Dir.down);
      case LogicalKeyboardKey.arrowLeft || LogicalKeyboardKey.keyA:
        _setDir(_Dir.left);
      case LogicalKeyboardKey.arrowRight || LogicalKeyboardKey.keyD:
        _setDir(_Dir.right);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('Score: $_score', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 1)),
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
            onPanStart: (d) => _swipeStart = d.globalPosition,
            onPanEnd: (_) {
              final start = _swipeStart;
              final end = _swipeEnd;
              if (start == null || end == null) return;
              final delta = end - start;
              if (delta.distance < 16) return;
              if (delta.dx.abs() > delta.dy.abs()) {
                _setDir(delta.dx > 0 ? _Dir.right : _Dir.left);
              } else {
                _setDir(delta.dy > 0 ? _Dir.down : _Dir.up);
              }
            },
            onPanUpdate: (d) => _swipeEnd = d.globalPosition,
            child: AspectRatio(
              aspectRatio: 1,
              child: LayoutBuilder(
                builder: (context, constraints) => CustomPaint(
                  size: Size(constraints.maxWidth, constraints.maxWidth),
                  painter: _SnakePainter(snake: _snake, food: _food),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (!_started || _gameOver) ...[
          if (_gameOver) const Padding(padding: EdgeInsets.only(bottom: 8), child: Text('Game Over!', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w900))),
          ElevatedButton(onPressed: _start, child: Text(_gameOver ? 'Restart' : 'Start Game')),
        ],
        const SizedBox(height: 8),
        const Text('화살표/WASD 또는 스와이프로 이동', style: TextStyle(fontSize: 11, color: Colors.grey)),
      ],
    );
  }
}

class _SnakePainter extends CustomPainter {
  _SnakePainter({required this.snake, required this.food});
  final List<Point<int>> snake;
  final Point<int> food;

  @override
  void paint(Canvas canvas, Size size) {
    final cell = size.width / _cols;
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), Paint()..color = const Color(0xFF0A0A0A));

    final gridPaint = Paint()
      ..color = const Color(0xFF1C1C1C)
      ..strokeWidth = 0.5;
    for (var i = 0; i <= _cols; i++) {
      canvas.drawLine(Offset(i * cell, 0), Offset(i * cell, size.height), gridPaint);
    }
    for (var i = 0; i <= _rows; i++) {
      canvas.drawLine(Offset(0, i * cell), Offset(size.width, i * cell), gridPaint);
    }

    canvas.drawCircle(Offset(food.x * cell + cell / 2, food.y * cell + cell / 2), cell / 2 - 2, Paint()..color = const Color(0xFFEF4444));

    for (var i = 0; i < snake.length; i++) {
      final seg = snake[i];
      final color = i == 0 ? const Color(0xFF22C55E) : (i < 3 ? const Color(0xFF16A34A) : const Color(0xFF15803D));
      final r = i == 0 ? 4.0 : 2.0;
      final rect = RRect.fromRectAndRadius(Rect.fromLTWH(seg.x * cell + 1, seg.y * cell + 1, cell - 2, cell - 2), Radius.circular(r));
      canvas.drawRRect(rect, Paint()..color = color);
    }
  }

  @override
  bool shouldRepaint(covariant _SnakePainter oldDelegate) => true;
}
