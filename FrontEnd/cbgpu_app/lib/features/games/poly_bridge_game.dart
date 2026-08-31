import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

const _w = 640.0, _h = 420.0;
const _waterY = _h - 60;
const _cliffW = 110.0;
const _gravity = 600.0;
const _substeps = 8;

class _Material {
  const _Material(this.color, this.maxStress, this.stiffness, this.tensionOnly, this.cost, this.label);
  final Color color;
  final double maxStress;
  final double stiffness;
  final bool tensionOnly;
  final int cost;
  final String label;
}

const _materials = {
  'road': _Material(Color(0xFF94A3B8), 0.65, 0.9, false, 10, '도로'),
  'wood': _Material(Color(0xFF92400E), 0.75, 0.85, false, 6, '나무'),
  'steel': _Material(Color(0xFF475569), 1.1, 0.98, false, 18, '철골'),
  'cable': _Material(Color(0xFFB45309), 0.9, 0.6, true, 8, '케이블'),
};

class _LevelConfig {
  const _LevelConfig(this.name, this.gap, this.budget, this.anchorYs, this.vehicles);
  final String name;
  final double gap;
  final int budget;
  final List<double> anchorYs;
  final List<(String kind, double weight)> vehicles;
}

const _levels = [
  _LevelConfig('1. 첫 다리', 260, 380, [200, 240, 280], [('car', 1)]),
  _LevelConfig('2. 무게감', 310, 300, [200, 260], [('car', 1.3)]),
  _LevelConfig('3. 두 번째 차', 350, 280, [200, 260], [('car', 1.2), ('truck', 2.2)]),
  _LevelConfig('4. 외팔보', 390, 230, [200], [('truck', 2), ('truck', 2.4)]),
  _LevelConfig('5. 극한 화물', 420, 210, [200], [('car', 1.2), ('truck', 2.4), ('truck', 3)]),
];

class _Node {
  _Node(this.id, this.x, this.y, {this.pinned = false}) : px = x, py = y;
  final int id;
  double x, y, px, py;
  bool pinned;
}

class _Edge {
  _Edge(this.id, this.a, this.b, this.mat, this.restLen);
  final int id;
  final int a, b;
  final String mat;
  final double restLen;
  double stress = 0;
  bool broken = false;
}

class _Vehicle {
  _Vehicle(this.x, this.y, this.w, this.h, this.weight, this.kind);
  double x, y, vx = 0, vy = 0;
  final double w, h, weight;
  final String kind;
  bool onGround = false;
  bool done = false;
  bool fell = false;
}

double _dist(double x1, double y1, double x2, double y2) => sqrt(pow(x2 - x1, 2) + pow(y2 - y1, 2));
double _clamp01(double t) => t.clamp(0, 1);

class PolyBridgeGame extends StatefulWidget {
  const PolyBridgeGame({super.key});
  @override
  State<PolyBridgeGame> createState() => _PolyBridgeGameState();
}

class _PolyBridgeGameState extends State<PolyBridgeGame> with SingleTickerProviderStateMixin {
  int _levelIdx = 0;
  String _phase = 'build'; // build, test, win, lose
  String _mat = 'road';
  int _budget = 0;
  int _vehiclesDone = 0;
  int _vehiclesTotal = 1;

  List<_Node> _nodes = [];
  List<_Edge> _edges = [];
  _Vehicle? _vehicle;
  List<(String, double)> _vehicleQueue = [];
  int _crossedCount = 0;
  int _nextNodeId = 0;
  int _nextEdgeId = 0;
  int _dragFrom = -1;
  double _mouseX = -99, _mouseY = -99;
  List<(int, double, double)> _nodeSnapshot = [];
  Rect _leftCliff = Rect.zero;
  Rect _rightCliff = Rect.zero;

  late final Ticker _ticker;
  Duration? _lastTs;

  @override
  void initState() {
    super.initState();
    _initLevel(0);
    _ticker = createTicker(_onTick)..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  void _onTick(Duration elapsed) {
    final dt = _lastTs == null ? 0.0 : ((elapsed - _lastTs!).inMicroseconds / 1e6).clamp(0.0, 0.05);
    _lastTs = elapsed;
    if (_phase == 'test') {
      setState(() => _physicsStep(dt));
    }
  }

  _Node _n(int id) => _nodes.firstWhere((n) => n.id == id);

  void _initLevel(int idx) {
    _levelIdx = idx;
    final level = _levels[idx];
    final leftCliffRight = _cliffW;
    _leftCliff = Rect.fromLTWH(leftCliffRight - _cliffW, 200, _cliffW, _h - 200);
    _rightCliff = Rect.fromLTWH(leftCliffRight + level.gap, 200, _w - (leftCliffRight + level.gap), _h - 200);

    final anchors = <(double, double)>[
      for (final y in level.anchorYs) (_leftCliff.left + _leftCliff.width, y),
      for (final y in level.anchorYs) (_rightCliff.left, y),
    ];
    _nodes = [for (var i = 0; i < anchors.length; i++) _Node(i, anchors[i].$1, anchors[i].$2, pinned: true)];
    _edges = [];
    _vehicle = null;
    _vehicleQueue = List.of(level.vehicles);
    _crossedCount = 0;
    _budget = level.budget;
    _nextNodeId = anchors.length;
    _nextEdgeId = 0;
    _dragFrom = -1;
    _nodeSnapshot = [];
    setState(() {
      _phase = 'build';
      _vehiclesDone = 0;
      _vehiclesTotal = level.vehicles.length;
    });
  }

  int _nearestNode(double x, double y, double maxD) {
    var best = -1;
    var bestD = maxD;
    for (final n in _nodes) {
      final d = _dist(x, y, n.x, n.y);
      if (d < bestD) {
        bestD = d;
        best = n.id;
      }
    }
    return best;
  }

  int _getOrCreateNode(double x, double y) {
    final ex = _nearestNode(x, y, 16);
    if (ex >= 0) return ex;
    final id = _nextNodeId++;
    _nodes.add(_Node(id, x, y));
    return id;
  }

  void _addEdge(int ai, int bi) {
    if (ai == bi) return;
    _Node? na, nb;
    for (final n in _nodes) {
      if (n.id == ai) na = n;
      if (n.id == bi) nb = n;
    }
    if (na == null || nb == null) return;
    if (_edges.any((e) => (e.a == ai && e.b == bi) || (e.a == bi && e.b == ai))) return;
    final len = _dist(na.x, na.y, nb.x, nb.y);
    if (len < 4) return;
    final cost = (len / 30).ceil() * _materials[_mat]!.cost;
    if (_budget < cost) return;
    setState(() {
      _budget -= cost;
      _edges.add(_Edge(_nextEdgeId++, ai, bi, _mat, len));
    });
  }

  void _physicsStep(double dt) {
    final v = _vehicle;
    _Edge? loadEdge;
    var loadT = 0.0;
    if (v != null && !v.done && !v.fell) {
      var bestLeft = double.negativeInfinity;
      for (final e in _edges) {
        if (e.broken || e.mat != 'road') continue;
        final na = _n(e.a), nb = _n(e.b);
        final left = min(na.x, nb.x), right = max(na.x, nb.x);
        if (v.x < left || v.x > right) continue;
        if (left > bestLeft) {
          bestLeft = left;
          loadEdge = e;
          loadT = _clamp01((v.x - na.x) / ((nb.x - na.x).abs() < 0.001 ? 0.001 : (nb.x - na.x)));
        }
      }
    }

    final sub = dt / _substeps;
    for (var step = 0; step < _substeps; step++) {
      for (final n in _nodes) {
        if (n.pinned) continue;
        final vx = n.x - n.px, vy = n.y - n.py;
        n.px = n.x;
        n.py = n.y;
        n.x += vx;
        n.y += vy + _gravity * sub * sub;
      }

      if (v != null && loadEdge != null) {
        final na = _n(loadEdge.a), nb = _n(loadEdge.b);
        final force = v.weight * _gravity * sub * sub * 0.9;
        if (!na.pinned) na.y += force * (1 - loadT);
        if (!nb.pinned) nb.y += force * loadT;
      }

      for (final e in _edges) {
        if (e.broken) continue;
        final na = _n(e.a), nb = _n(e.b);
        final dx = nb.x - na.x, dy = nb.y - na.y;
        final len = sqrt(dx * dx + dy * dy).clamp(0.001, double.infinity);
        final diff = (len - e.restLen) / len;
        final matDef = _materials[e.mat]!;
        if (matDef.tensionOnly && diff > 0) continue;
        final correction = diff * matDef.stiffness * 0.5;
        e.stress = diff.abs();
        if (!na.pinned) {
          na.x += dx * correction;
          na.y += dy * correction;
        }
        if (!nb.pinned) {
          nb.x -= dx * correction;
          nb.y -= dy * correction;
        }
        if (e.stress > matDef.maxStress) e.broken = true;
      }

      for (final n in _nodes) {
        if (n.pinned) continue;
        if (n.x < _leftCliff.left + _leftCliff.width && n.y > _leftCliff.top) {
          final vy = n.y - n.py;
          n.y = _leftCliff.top;
          n.py = n.y + vy * 0.3;
        }
        if (n.x > _rightCliff.left && n.y > _rightCliff.top) {
          final vy = n.y - n.py;
          n.y = _rightCliff.top;
          n.py = n.y + vy * 0.3;
        }
      }
    }

    if (_nodes.any((n) => !n.pinned && n.y > _waterY + 10)) {
      _phase = 'lose';
      return;
    }

    if (v == null || v.done || v.fell) return;

    v.vx = min(v.vx + 70 * dt, 150);
    v.vy += _gravity * dt;

    var groundY = double.infinity;
    for (final e in _edges) {
      if (e.broken || e.mat != 'road') continue;
      final na = _n(e.a), nb = _n(e.b);
      final left = min(na.x, nb.x), right = max(na.x, nb.x);
      if (v.x + v.w / 2 < left || v.x - v.w / 2 > right) continue;
      final t = _clamp01((v.x - na.x) / ((nb.x - na.x).abs() < 0.001 ? 0.001 : (nb.x - na.x)));
      final ey = na.y + t * (nb.y - na.y);
      if (ey < groundY) groundY = ey;
    }
    if (v.x - v.w / 2 < _leftCliff.left + _leftCliff.width) groundY = min(groundY, _leftCliff.top);
    if (v.x + v.w / 2 > _rightCliff.left) groundY = min(groundY, _rightCliff.top);

    final vehicleBottom = v.y + v.h / 2;
    if (vehicleBottom >= groundY - 2 && v.vy >= 0) {
      v.y = groundY - v.h / 2;
      v.vy = 0;
      v.onGround = true;
    } else {
      v.onGround = false;
    }

    v.x += v.vx * dt;
    v.y += v.vy * dt;

    if (v.y > _waterY) {
      v.fell = true;
      _phase = 'lose';
    }
    if (v.x > _rightCliff.left + _rightCliff.width) {
      v.done = true;
      _crossedCount++;
      _vehiclesDone = _crossedCount;
      if (_vehicleQueue.isNotEmpty) {
        final next = _vehicleQueue.removeAt(0);
        _vehicle = _makeVehicle(next.$1, next.$2, _leftCliff.left + _leftCliff.width - 10, _leftCliff.top - 22);
      } else {
        _phase = 'win';
      }
    }
  }

  _Vehicle _makeVehicle(String kind, double weight, double startX, double startY) {
    final isTruck = kind == 'truck';
    return _Vehicle(startX, startY, isTruck ? 58 : 44, isTruck ? 30 : 24, weight, kind);
  }

  void _startTest() {
    _nodeSnapshot = [for (final n in _nodes) (n.id, n.x, n.y)];
    final level = _levels[_levelIdx];
    _vehicleQueue = level.vehicles.skip(1).toList();
    _crossedCount = 0;
    final first = level.vehicles.first;
    setState(() {
      _vehiclesDone = 0;
      _vehicle = _makeVehicle(first.$1, first.$2, _leftCliff.left + _leftCliff.width - 10, _leftCliff.top - 22);
      _phase = 'test';
    });
  }

  void _backToBuild() {
    for (final (id, x, y) in _nodeSnapshot) {
      final n = _nodes.where((nd) => nd.id == id).firstOrNull;
      if (n != null) {
        n.x = x;
        n.y = y;
        n.px = x;
        n.py = y;
      }
    }
    for (final e in _edges) {
      e.broken = false;
      e.stress = 0;
    }
    setState(() {
      _vehicle = null;
      _phase = 'build';
      _nodeSnapshot = [];
      _vehiclesDone = 0;
    });
  }

  void _clearBridge() {
    setState(() {
      _edges = [];
      _nodes = _nodes.where((n) => n.pinned).toList();
      _budget = _levels[_levelIdx].budget;
    });
  }

  void _resetAll() => _initLevel(_levelIdx);
  void _nextLevel() => _initLevel(min(_levels.length - 1, _levelIdx + 1));

  @override
  Widget build(BuildContext context) {
    final budgetPct = _budget / _levels[_levelIdx].budget * 100;
    final isLastLevel = _levelIdx == _levels.length - 1;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 36,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              for (var i = 0; i < _levels.length; i++)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(_levels[i].name, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900)),
                    selected: i == _levelIdx,
                    onSelected: _phase == 'test' ? null : (_) => _initLevel(i),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        AspectRatio(
          aspectRatio: _w / _h,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final scale = constraints.maxWidth / _w;
              return ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: Stack(
                  children: [
                    GestureDetector(
                      onPanStart: _phase == 'build'
                          ? (d) {
                              final p = d.localPosition / scale;
                              final nn = _nearestNode(p.dx, p.dy, 22);
                              setState(() => _dragFrom = nn >= 0 ? nn : _getOrCreateNode(p.dx, p.dy));
                              _mouseX = p.dx;
                              _mouseY = p.dy;
                            }
                          : null,
                      onPanUpdate: _phase == 'build'
                          ? (d) {
                              final p = d.localPosition / scale;
                              setState(() {
                                _mouseX = p.dx;
                                _mouseY = p.dy;
                              });
                            }
                          : null,
                      onPanEnd: _phase == 'build' && _dragFrom >= 0
                          ? (d) {
                              var to = _nearestNode(_mouseX, _mouseY, 22);
                              if (to < 0) to = _getOrCreateNode(_mouseX, _mouseY);
                              _addEdge(_dragFrom, to);
                              setState(() => _dragFrom = -1);
                            }
                          : null,
                      child: CustomPaint(
                        size: Size(constraints.maxWidth, constraints.maxHeight),
                        painter: _BridgePainter(
                          nodes: _nodes,
                          edges: _edges,
                          vehicle: _vehicle,
                          leftCliff: _leftCliff,
                          rightCliff: _rightCliff,
                          phase: _phase,
                          mat: _mat,
                          dragFrom: _dragFrom,
                          mouseX: _mouseX,
                          mouseY: _mouseY,
                          budgetForDrag: _budget,
                        ),
                      ),
                    ),
                    if (_phase == 'test' && _vehiclesTotal > 1)
                      Positioned(
                        top: 10,
                        right: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(20)),
                          child: Text('차량 ${min(_vehiclesDone + 1, _vehiclesTotal)}/$_vehiclesTotal', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)),
                        ),
                      ),
                    if (_phase == 'win' || _phase == 'lose')
                      Positioned.fill(
                        child: Container(
                          color: Colors.black.withValues(alpha: 0.65),
                          child: Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(_phase == 'win' ? '🎉' : '💧', style: const TextStyle(fontSize: 44)),
                                const SizedBox(height: 8),
                                Text(_phase == 'win' ? '다리 완성!' : '다리 붕괴!', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 20)),
                                const SizedBox(height: 4),
                                Text(
                                  _phase == 'win' ? '차량 $_vehiclesTotal대가 무사히 건넜습니다!' : '$_vehiclesDone/$_vehiclesTotal대를 건넨 뒤 무너졌습니다.',
                                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                                ),
                                const SizedBox(height: 12),
                                Wrap(spacing: 8, alignment: WrapAlignment.center, children: [
                                  ElevatedButton(onPressed: _backToBuild, child: const Text('수정하기')),
                                  ElevatedButton(onPressed: _resetAll, child: const Text('다시 시작')),
                                  if (_phase == 'win' && !isLastLevel) ElevatedButton(onPressed: _nextLevel, child: const Text('다음 레벨 →')),
                                ]),
                              ],
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 10),
        Row(children: [
          const Text('예산', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.grey)),
          const Spacer(),
          Text('$_budget / ${_levels[_levelIdx].budget}', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: budgetPct < 15 ? Colors.red : (budgetPct < 40 ? Colors.amber : Colors.grey))),
        ]),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(value: (budgetPct / 100).clamp(0, 1), minHeight: 6, backgroundColor: Colors.grey.withValues(alpha: 0.15), color: budgetPct > 40 ? Colors.green : (budgetPct > 15 ? Colors.amber : Colors.red)),
        ),
        const SizedBox(height: 10),
        if (_phase == 'build') ...[
          Row(children: [for (final id in _materials.keys) Expanded(child: _matButton(id))]),
          const SizedBox(height: 8),
          Row(children: [
            OutlinedButton(onPressed: _clearBridge, child: const Text('지우기')),
            const SizedBox(width: 8),
            Expanded(child: ElevatedButton(onPressed: _startTest, child: const Text('🚗 테스트'))),
          ]),
        ] else if (_phase == 'test')
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: _backToBuild, child: const Text('← 수정하기'))),
            const SizedBox(width: 8),
            OutlinedButton(style: OutlinedButton.styleFrom(foregroundColor: Colors.red), onPressed: _resetAll, child: const Text('초기화')),
          ]),
        const SizedBox(height: 8),
        if (_phase == 'build')
          const Text('노란 앵커에서 드래그해 자재를 연결하세요 · 차가 지날 때 무게가 다리를 누르니 튼튼하게 지지하세요', style: TextStyle(fontSize: 10, color: Colors.grey), textAlign: TextAlign.center)
        else if (_phase == 'test')
          const Text('스트레스: 초록 → 노랑 → 빨강 · 빨간 점선 = 파손됨', style: TextStyle(fontSize: 10, color: Colors.grey), textAlign: TextAlign.center),
      ],
    );
  }

  Widget _matButton(String id) {
    final m = _materials[id]!;
    final selected = _mat == id;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: InkWell(
        onTap: () => setState(() => _mat = id),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(color: selected ? Theme.of(context).colorScheme.primary : Colors.grey.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
          child: Column(children: [
            Text(m.label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: selected ? Colors.white : null)),
            Text('${m.cost}/30px', style: TextStyle(fontSize: 8, color: selected ? Colors.white70 : Colors.grey)),
          ]),
        ),
      ),
    );
  }
}

extension _FirstOrNullExt<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

class _BridgePainter extends CustomPainter {
  _BridgePainter({
    required this.nodes,
    required this.edges,
    required this.vehicle,
    required this.leftCliff,
    required this.rightCliff,
    required this.phase,
    required this.mat,
    required this.dragFrom,
    required this.mouseX,
    required this.mouseY,
    required this.budgetForDrag,
  });
  final List<_Node> nodes;
  final List<_Edge> edges;
  final _Vehicle? vehicle;
  final Rect leftCliff;
  final Rect rightCliff;
  final String phase;
  final String mat;
  final int dragFrom;
  final double mouseX, mouseY;
  final int budgetForDrag;

  Color _stressColor(double s, bool broken) {
    if (broken) return const Color(0xFFEF4444);
    if (s < 0.4) return const Color(0xFF22C55E);
    if (s < 0.7) return Color.lerp(const Color(0xFF22C55E), const Color(0xFFF59E0B), (s - 0.4) / 0.3)!;
    return Color.lerp(const Color(0xFFF59E0B), const Color(0xFFEF4444), (s - 0.7) / 0.3)!;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / _w;
    final sy = size.height / _h;
    canvas.save();
    canvas.scale(sx, sy);

    final sky = Paint()..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF0F172A), Color(0xFF1E3A5F), Color(0xFF1E3A5F)]).createShader(const Rect.fromLTWH(0, 0, _w, _h));
    canvas.drawRect(const Rect.fromLTWH(0, 0, _w, _h), sky);

    final water = Paint()..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xB238BDF8), Color(0xF20284C7)]).createShader(Rect.fromLTWH(0, _waterY, _w, _h - _waterY));
    canvas.drawRect(Rect.fromLTWH(0, _waterY, _w, _h - _waterY), water);

    canvas.drawRect(leftCliff, Paint()..color = const Color(0xFF334155));
    canvas.drawRect(rightCliff, Paint()..color = const Color(0xFF334155));
    canvas.drawRect(Rect.fromLTWH(leftCliff.left, leftCliff.top, leftCliff.width, 4), Paint()..color = const Color(0xFF475569));
    canvas.drawRect(Rect.fromLTWH(rightCliff.left, rightCliff.top, rightCliff.width, 4), Paint()..color = const Color(0xFF475569));

    _Node n(int id) => nodes.firstWhere((nd) => nd.id == id);

    for (final e in edges) {
      final na = n(e.a), nb = n(e.b);
      final width = e.mat == 'steel' ? 5.0 : (e.mat == 'road' ? 6.0 : (e.mat == 'cable' ? 2.0 : 4.0));
      final paint = Paint()
        ..strokeWidth = width
        ..strokeCap = StrokeCap.round;
      if (phase == 'test') {
        paint.color = _stressColor(e.stress, e.broken);
      } else {
        paint.color = _materials[e.mat]!.color;
      }
      if (e.broken || e.mat == 'cable') {
        _drawDashedLine(canvas, Offset(na.x, na.y), Offset(nb.x, nb.y), paint);
      } else {
        canvas.drawLine(Offset(na.x, na.y), Offset(nb.x, nb.y), paint);
      }
    }

    if (dragFrom >= 0 && phase == 'build') {
      final na = nodes.where((nd) => nd.id == dragFrom).firstOrNull;
      if (na != null) {
        final paint = Paint()
          ..color = _materials[mat]!.color.withValues(alpha: 0.7)
          ..strokeWidth = 3;
        _drawDashedLine(canvas, Offset(na.x, na.y), Offset(mouseX, mouseY), paint);
        final len = _dist(na.x, na.y, mouseX, mouseY);
        final cost = (len / 30).ceil() * _materials[mat]!.cost;
        final tp = TextPainter(text: TextSpan(text: '-$cost', style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold)), textDirection: TextDirection.ltr)..layout();
        tp.paint(canvas, Offset((na.x + mouseX) / 2 + 6, (na.y + mouseY) / 2 - 12));
      }
    }

    for (final nd in nodes) {
      final r = nd.pinned ? 8.0 : 5.0;
      if (nd.pinned) {
        canvas.drawCircle(Offset(nd.x, nd.y), r, Paint()..color = const Color(0xFFF59E0B));
        canvas.drawCircle(Offset(nd.x, nd.y), r, Paint()
          ..color = const Color(0xFFFBBF24)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2);
      } else {
        canvas.drawCircle(Offset(nd.x, nd.y), r, Paint()..color = const Color(0xFF94A3B8));
      }
    }

    final v = vehicle;
    if (v != null) {
      final vx = v.x - v.w / 2, vy = v.y - v.h / 2;
      final bodyColor = v.fell ? const Color(0xFFEF4444) : (v.kind == 'truck' ? const Color(0xFF7C3AED) : const Color(0xFFF97316));
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(vx, vy, v.w, v.h), const Radius.circular(5)), Paint()..color = bodyColor);
      final cabinColor = v.fell ? const Color(0xFFDC2626) : (v.kind == 'truck' ? const Color(0xFF6D28D9) : const Color(0xFFEA580C));
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(vx + v.w * 0.3, vy - v.h * 0.5, v.w * 0.5, v.h * 0.6), const Radius.circular(3)), Paint()..color = cabinColor);
      final wr = v.h * 0.42;
      for (final wx in [vx + wr, vx + v.w - wr]) {
        canvas.drawCircle(Offset(wx, vy + v.h), wr, Paint()..color = const Color(0xFF1E293B));
        canvas.drawCircle(Offset(wx, vy + v.h), wr * 0.4, Paint()..color = const Color(0xFF94A3B8));
      }
    }

    canvas.restore();
  }

  void _drawDashedLine(Canvas canvas, Offset a, Offset b, Paint paint) {
    const dashLen = 5.0, gapLen = 4.0;
    final total = (b - a).distance;
    if (total < 0.01) return;
    final dir = (b - a) / total;
    var dist = 0.0;
    while (dist < total) {
      final segEnd = min(dist + dashLen, total);
      canvas.drawLine(a + dir * dist, a + dir * segEnd, paint);
      dist += dashLen + gapLen;
    }
  }

  @override
  bool shouldRepaint(covariant _BridgePainter oldDelegate) => true;
}
