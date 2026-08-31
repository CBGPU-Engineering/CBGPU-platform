import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';

const _w = 360.0, _h = 480.0;
const _jump = -8.5;
const _pipeW = 52.0, _gap = 140.0, _pipeSpeed = 2.8, _birdX = 70.0;

class _Pipe {
  _Pipe(this.x, this.top, this.id);
  double x;
  final double top;
  final int id;
}

double _randTop() => 60 + Random().nextDouble() * (_h - _gap - 120);

class FlappyBirdGame extends StatefulWidget {
  const FlappyBirdGame({super.key});
  @override
  State<FlappyBirdGame> createState() => _FlappyBirdGameState();
}

class _FlappyBirdGameState extends State<FlappyBirdGame> with SingleTickerProviderStateMixin {
  double _birdY = _h / 2;
  double _birdVy = 0;
  List<_Pipe> _pipes = [];
  final Set<int> _scored = {};
  int _pipeIdCounter = 0;
  int _frame = 0;
  int _score = 0;
  int _best = 0;
  String _phase = 'idle'; // idle, running, over
  late final Ticker _ticker;
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick)..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onTick(Duration elapsed) {
    if (_phase != 'running') return;
    setState(() {
      _birdVy += 0.45;
      _birdY += _birdVy;
      _frame++;

      if (_frame % 90 == 0) _pipes.add(_Pipe(_w + 10, _randTop(), _pipeIdCounter++));
      for (final p in _pipes) {
        p.x -= _pipeSpeed;
      }
      _pipes = _pipes.where((p) => p.x > -_pipeW - 10).toList();

      for (final p in _pipes) {
        if (!_scored.contains(p.id) && p.x + _pipeW < _birdX) {
          _scored.add(p.id);
          _score++;
        }
      }

      if (_birdY > _h - 56 || _birdY < 10) {
        _endGame();
        return;
      }
      for (final p in _pipes) {
        if (_birdX + 16 > p.x + 4 && _birdX - 16 < p.x + _pipeW - 4) {
          if (_birdY - 14 < p.top || _birdY + 14 > p.top + _gap) {
            _endGame();
            return;
          }
        }
      }
    });
  }

  void _endGame() {
    _phase = 'over';
    if (_score > _best) _best = _score;
  }

  void _flap() {
    if (_phase == 'over') return;
    setState(() {
      if (_phase == 'idle') _phase = 'running';
      _birdVy = _jump;
    });
  }

  void _reset() {
    setState(() {
      _birdY = _h / 2;
      _birdVy = 0;
      _pipes = [];
      _scored.clear();
      _frame = 0;
      _score = 0;
      _phase = 'idle';
    });
  }

  void _onKey(KeyEvent event) {
    if (event is KeyDownEvent && event.logicalKey == LogicalKeyboardKey.space) _flap();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(mainAxisSize: MainAxisSize.min, children: [
          Text('Score: $_score', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
          const SizedBox(width: 16),
          Text('Best: $_best', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Colors.grey.shade600)),
        ]),
        const SizedBox(height: 12),
        Focus(
          focusNode: _focusNode,
          autofocus: true,
          onKeyEvent: (node, event) {
            _onKey(event);
            return KeyEventResult.handled;
          },
          child: GestureDetector(
            onTap: _flap,
            child: Stack(
              alignment: Alignment.center,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: AspectRatio(
                    aspectRatio: _w / _h,
                    child: LayoutBuilder(
                      builder: (context, constraints) => CustomPaint(
                        size: Size(constraints.maxWidth, constraints.maxHeight),
                        painter: _FlappyPainter(birdY: _birdY, birdVy: _birdVy, pipes: _pipes, score: _score),
                      ),
                    ),
                  ),
                ),
                if (_phase == 'idle')
                  _overlay(children: [
                    const Text('Flappy Bird', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 22)),
                    const SizedBox(height: 6),
                    const Text('탭 / 스페이스바로 점프', style: TextStyle(color: Colors.white70, fontSize: 12)),
                    const SizedBox(height: 12),
                    ElevatedButton(onPressed: _flap, child: const Text('Start')),
                  ]),
                if (_phase == 'over')
                  _overlay(children: [
                    const Text('Game Over', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 22)),
                    const SizedBox(height: 6),
                    Text('Score: $_score · Best: $_best', style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    ElevatedButton(onPressed: _reset, child: const Text('Restart')),
                  ]),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        const Text('탭 또는 스페이스바로 점프', style: TextStyle(fontSize: 11, color: Colors.grey)),
      ],
    );
  }

  Widget _overlay({required List<Widget> children}) {
    return Positioned.fill(
      child: Container(
        decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.45), borderRadius: BorderRadius.circular(18)),
        child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: children)),
      ),
    );
  }
}

class _FlappyPainter extends CustomPainter {
  _FlappyPainter({required this.birdY, required this.birdVy, required this.pipes, required this.score});
  final double birdY;
  final double birdVy;
  final List<_Pipe> pipes;
  final int score;

  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / _w;
    final sy = size.height / _h;
    canvas.save();
    canvas.scale(sx, sy);

    final sky = Paint()..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF1E3A5F), Color(0xFF4A90D9)]).createShader(const Rect.fromLTWH(0, 0, _w, _h));
    canvas.drawRect(const Rect.fromLTWH(0, 0, _w, _h), sky);

    canvas.drawRect(const Rect.fromLTWH(0, _h - 40, _w, 40), Paint()..color = const Color(0xFF5C8A3C));
    canvas.drawRect(const Rect.fromLTWH(0, _h - 40, _w, 8), Paint()..color = const Color(0xFF7AB648));

    for (final p in pipes) {
      final grad = Paint()..shader = const LinearGradient(colors: [Color(0xFF4CAF50), Color(0xFF81C784), Color(0xFF388E3C)]).createShader(Rect.fromLTWH(p.x, 0, _pipeW, _h));
      canvas.drawRRect(RRect.fromRectAndCorners(Rect.fromLTWH(p.x, 0, _pipeW, p.top), bottomLeft: const Radius.circular(6), bottomRight: const Radius.circular(6)), grad);
      canvas.drawRect(Rect.fromLTWH(p.x - 4, p.top - 22, _pipeW + 8, 22), grad);
      canvas.drawRRect(RRect.fromRectAndCorners(Rect.fromLTWH(p.x, p.top + _gap, _pipeW, _h - p.top - _gap - 40), topLeft: const Radius.circular(6), topRight: const Radius.circular(6)), grad);
      canvas.drawRect(Rect.fromLTWH(p.x - 4, p.top + _gap, _pipeW + 8, 22), grad);
    }

    canvas.save();
    canvas.translate(_birdX, birdY);
    final angle = (birdVy * 0.06).clamp(-0.4, 1.2);
    canvas.rotate(angle);
    canvas.drawOval(Rect.fromCenter(center: Offset.zero, width: 40, height: 32), Paint()..color = const Color(0xFFFDD835));
    canvas.drawOval(Rect.fromCenter(center: const Offset(-4, 4), width: 28, height: 20), Paint()..color = const Color(0xFFF9A825));
    canvas.drawCircle(const Offset(8, -4), 7, Paint()..color = Colors.white);
    canvas.drawCircle(const Offset(10, -4), 4, Paint()..color = const Color(0xFF1A237E));
    final beak = Path()
      ..moveTo(14, 2)
      ..lineTo(22, -2)
      ..lineTo(22, 6)
      ..close();
    canvas.drawPath(beak, Paint()..color = const Color(0xFFE53935));
    canvas.drawOval(Rect.fromCenter(center: const Offset(-6, 2), width: 20, height: 12), Paint()..color = const Color(0xFFF9A825));
    canvas.restore();

    final scoreRect = RRect.fromRectAndRadius(Rect.fromCenter(center: const Offset(_w / 2, 28), width: 60, height: 32), const Radius.circular(6));
    canvas.drawRRect(scoreRect, Paint()..color = Colors.black.withValues(alpha: 0.3));
    final tp = TextPainter(text: TextSpan(text: '$score', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 22)), textDirection: TextDirection.ltr)..layout();
    tp.paint(canvas, Offset(_w / 2 - tp.width / 2, 12));

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _FlappyPainter oldDelegate) => true;
}
