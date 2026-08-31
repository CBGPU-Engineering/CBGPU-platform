import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/eduset.dart' as eduset;
import '../../core/glass.dart';

const _officialStudyUrl = 'https://cbsh.edu-set.com';
const _fallbackMinPeriods = 4;

class _Occupant {
  _Occupant(this.label, this.period, this.status);
  final String label;
  final int period;
  final eduset.SelfStudyStatus status;
}

class _OccupancyEntry {
  _OccupancyEntry({
    required this.roomId,
    required this.roomName,
    required this.seatName,
    required this.period,
    required this.label,
    required this.studentId,
    required this.status,
  });
  final int roomId;
  final String roomName;
  final String seatName;
  final int period;
  final String label;
  final int studentId;
  final eduset.SelfStudyStatus status;
}

class _RoomData {
  _RoomData({
    required this.room,
    this.seats = const [],
    this.obstacles = const [],
    Map<int, List<_Occupant>>? occupantsBySeat,
    this.occupancy = const [],
    this.failed = false,
  }) : occupantsBySeat = occupantsBySeat ?? {};
  final eduset.Room room;
  final List<eduset.Seat> seats;
  final List<eduset.Obstacle> obstacles;
  final Map<int, List<_Occupant>> occupantsBySeat;
  final List<_OccupancyEntry> occupancy;
  final bool failed;
}

class StudyScreen extends StatefulWidget {
  const StudyScreen({super.key});
  @override
  State<StudyScreen> createState() => _StudyScreenState();
}

class _StudyScreenState extends State<StudyScreen> {
  List<_RoomData> _roomData = [];
  List<eduset.Student> _allStudents = [];
  int _periodCount = 0;
  bool _loading = true;
  String? _error;
  String _query = '';
  String _studentQuery = '';
  eduset.Student? _selectedStudent;
  int _selectedPeriod = 1;
  String _searchMode = 'room';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        eduset.getRooms(),
        eduset.getSelfStudyPolicy().catchError((_) => null as dynamic),
        eduset.getStudents().catchError((_) => <eduset.Student>[]),
      ]);
      final rooms = results[0] as List<eduset.Room>;
      final policy = results[1] as eduset.SelfStudyPolicy?;
      final students = results[2] as List<eduset.Student>;
      _allStudents = students;

      final today = DateTime.now();
      final dateStr = eduset.localDateStr(today);

      List<eduset.SelfStudyEntry>? selfStudyEntries;
      try {
        // A failed aggregate search already has a room-by-room fallback in
        // _loadRoom. Retrying it three times made a temporary upstream stall
        // look like an infinite spinner for over a minute.
        selfStudyEntries = await eduset.searchSelfStudy(dateStr);
      } catch (_) {
        selfStudyEntries = null;
      }

      final data = await Future.wait(
        rooms.map((room) => _loadRoom(room, selfStudyEntries, dateStr)),
      );
      _roomData = data;

      var periodCount = 0;
      if (policy != null) {
        periodCount = eduset.getPeriodCountForDate(policy, today);
      }
      if (periodCount <= 0) {
        var maxObserved = 0;
        for (final d in data) {
          for (final list in d.occupantsBySeat.values) {
            for (final o in list) {
              if (o.period > maxObserved) maxObserved = o.period;
            }
          }
        }
        periodCount = maxObserved > _fallbackMinPeriods
            ? maxObserved
            : _fallbackMinPeriods;
      }
      _periodCount = periodCount;
      if (_selectedPeriod > _periodCount) _selectedPeriod = 1;
    } catch (e) {
      _error = e.toString().replaceFirst('EdusetError: ', '');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<_RoomData> _loadRoom(
    eduset.Room room,
    List<eduset.SelfStudyEntry>? selfStudyEntries,
    String dateStr,
  ) async {
    if (!room.hasSeats) {
      try {
        final occupancy = <_OccupancyEntry>[];
        final roomEntries = selfStudyEntries
            ?.where(
              (e) =>
                  e.roomId == room.id &&
                  e.status != eduset.SelfStudyStatus.rejected,
            )
            .toList();
        if (selfStudyEntries != null && roomEntries != null) {
          for (final e in roomEntries) {
            occupancy.add(
              _OccupancyEntry(
                roomId: room.id,
                roomName: room.name,
                seatName: '',
                period: e.period,
                label: eduset.formatStudentLabel(e.student),
                studentId: e.student.id,
                status: e.status,
              ),
            );
          }
        } else {
          final occupations = await eduset.getSeatOccupations(room.id, dateStr);
          final studentIds = occupations.map((o) => o.studentId).toSet();
          final labelById = <int, String>{};
          await Future.wait(
            studentIds.map((id) async {
              try {
                labelById[id] = eduset.formatStudentLabel(
                  await eduset.getStudent(id),
                );
              } catch (_) {}
            }),
          );
          for (final o in occupations) {
            final label = labelById[o.studentId];
            if (label == null) continue;
            occupancy.add(
              _OccupancyEntry(
                roomId: room.id,
                roomName: room.name,
                seatName: '',
                period: o.period,
                label: label,
                studentId: o.studentId,
                status: eduset.SelfStudyStatus.approved,
              ),
            );
          }
        }
        return _RoomData(room: room, occupancy: occupancy);
      } catch (_) {
        return _RoomData(room: room, failed: true);
      }
    }

    try {
      final composition = await eduset.getRoomComposition(room.id);
      final seatNameById = {for (final s in composition.seats) s.id: s.name};
      final occupantsBySeat = <int, List<_Occupant>>{};
      final occupancy = <_OccupancyEntry>[];

      void addEntry(
        int seatId,
        String seatName,
        int period,
        int studentId,
        String label,
        eduset.SelfStudyStatus status,
      ) {
        occupantsBySeat
            .putIfAbsent(seatId, () => [])
            .add(_Occupant(label, period, status));
        occupancy.add(
          _OccupancyEntry(
            roomId: room.id,
            roomName: room.name,
            seatName: seatName,
            period: period,
            label: label,
            studentId: studentId,
            status: status,
          ),
        );
      }

      final roomEntries = selfStudyEntries
          ?.where(
            (e) =>
                e.roomId == room.id &&
                e.type == 'selfstudy' &&
                e.status != eduset.SelfStudyStatus.rejected &&
                e.seatId != null,
          )
          .toList();
      if (selfStudyEntries != null && roomEntries != null) {
        for (final e in roomEntries) {
          addEntry(
            e.seatId!,
            e.seatName ?? '',
            e.period,
            e.student.id,
            eduset.formatStudentLabel(e.student),
            e.status,
          );
        }
      } else {
        final occupations = await eduset.getSeatOccupations(room.id, dateStr);
        final studentIds = occupations.map((o) => o.studentId).toSet();
        final labelById = <int, String>{};
        await Future.wait(
          studentIds.map((id) async {
            try {
              labelById[id] = eduset.formatStudentLabel(
                await eduset.getStudent(id),
              );
            } catch (_) {}
          }),
        );
        for (final o in occupations) {
          final label = labelById[o.studentId];
          if (label == null) continue;
          addEntry(
            o.seatId,
            seatNameById[o.seatId] ?? '',
            o.period,
            o.studentId,
            label,
            eduset.SelfStudyStatus.approved,
          );
        }
      }
      return _RoomData(
        room: room,
        seats: composition.seats,
        obstacles: composition.obstacles,
        occupantsBySeat: occupantsBySeat,
        occupancy: occupancy,
      );
    } catch (_) {
      return _RoomData(room: room);
    }
  }

  void _openRoomDialog(_RoomData data) {
    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(
            '${data.room.name} ${data.room.hasSeats ? '좌석 배치' : '신청자 명단'}',
          ),
          content: SizedBox(
            width: 480,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  data.room.hasSeats
                      ? '좌석 번호 옆에 학번/이름이 표시됩니다.'
                      : '정원제 자습실이라 좌석 없이 신청자만 표시됩니다.',
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 4,
                  children: [
                    for (var p = 1; p <= _periodCount; p++)
                      ChoiceChip(
                        label: Text(
                          '$p교시',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        selected: _selectedPeriod == p,
                        onSelected: (_) {
                          setDialogState(() => _selectedPeriod = p);
                          setState(() {});
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                if (data.room.hasSeats)
                  _SeatMap(
                    room: data.room,
                    seats: data.seats,
                    obstacles: data.obstacles,
                    occupantsBySeat: data.occupantsBySeat,
                    selectedPeriod: _selectedPeriod,
                  )
                else
                  _CapacityList(
                    occupancy: data.occupancy,
                    selectedPeriod: _selectedPeriod,
                    failed: data.failed,
                    onRetry: () {
                      Navigator.pop(context);
                      _load();
                    },
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('닫기'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final periods = List.generate(_periodCount, (i) => i + 1);
    final q = _query.trim().toLowerCase();
    final filtered = q.isEmpty
        ? _roomData
        : _roomData
              .where((d) => d.room.name.toLowerCase().contains(q))
              .toList();
    final sorted = [...filtered]
      ..sort((a, b) {
        int occ(_RoomData d) => d.room.hasSeats
            ? d.occupantsBySeat.values
                  .where((l) => l.any((o) => o.period == _selectedPeriod))
                  .length
            : d.occupancy.where((o) => o.period == _selectedPeriod).length;
        return occ(b).compareTo(occ(a));
      });

    final studentMatches = _studentQuery.trim().isEmpty
        ? <eduset.Student>[]
        : _allStudents
              .where(
                (s) => eduset
                    .formatStudentLabel(s)
                    .toLowerCase()
                    .contains(_studentQuery.trim().toLowerCase()),
              )
              .take(8)
              .toList();

    final occupancyIndex = _roomData.expand((d) => d.occupancy).toList();
    _OccupancyEntry? selectedEntry;
    if (_selectedStudent != null) {
      final matches = occupancyIndex.where(
        (e) =>
            e.studentId == _selectedStudent!.id && e.period == _selectedPeriod,
      );
      selectedEntry = matches.isEmpty ? null : matches.first;
    }

    return AmbientBackground(
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1056),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 32, 16, 112),
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '실시간 현황',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            color: Colors.grey,
                            fontSize: 11,
                            letterSpacing: 1.4,
                          ),
                        ),
                        Text(
                          '자습신청',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 30,
                            letterSpacing: -0.8,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: Icon(
                      Icons.refresh,
                      size: 18,
                      color: _loading ? Colors.grey : null,
                    ),
                    onPressed: _loading ? null : _load,
                  ),
                  const SizedBox(width: 4),
                  FilledButton.icon(
                    onPressed: () => launchUrl(
                      Uri.parse(_officialStudyUrl),
                      mode: LaunchMode.externalApplication,
                    ),
                    icon: const Icon(Icons.open_in_new, size: 16),
                    label: const Text(
                      '공식 사이트',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (periods.isNotEmpty) ...[
                Wrap(
                  spacing: 4,
                  children: [
                    for (final p in periods)
                      ChoiceChip(
                        label: Text(
                          '$p교시',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        selected: _selectedPeriod == p,
                        onSelected: (_) => setState(() => _selectedPeriod = p),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
              ],
              Row(
                children: [
                  ChoiceChip(
                    label: const Text('자습실로 찾기'),
                    selected: _searchMode == 'room',
                    onSelected: (_) => setState(() => _searchMode = 'room'),
                  ),
                  const SizedBox(width: 6),
                  ChoiceChip(
                    label: const Text('학생으로 찾기'),
                    selected: _searchMode == 'student',
                    onSelected: (_) => setState(() => _searchMode = 'student'),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (_searchMode == 'room')
                TextField(
                  decoration: const InputDecoration(
                    hintText: '자습실 이름으로 검색',
                    prefixIcon: Icon(Icons.search, size: 18),
                  ),
                  onChanged: (v) => setState(() => _query = v),
                )
              else if (_selectedStudent != null)
                GlassCard(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              eduset.formatStudentLabel(_selectedStudent!),
                              style: const TextStyle(
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: () => setState(() {
                              _selectedStudent = null;
                              _studentQuery = '';
                            }),
                            child: const Text(
                              '다른 학생 검색',
                              style: TextStyle(fontSize: 11),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.grey.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                selectedEntry != null
                                    ? '$_selectedPeriod교시: ${selectedEntry.roomName}${selectedEntry.seatName.isNotEmpty ? ' ${selectedEntry.seatName}번 자리' : ''}에 신청했습니다.${selectedEntry.status == eduset.SelfStudyStatus.pending ? ' (승인 대기중)' : ''}'
                                    : '$_selectedPeriod교시: 아직 신청하지 않았습니다.',
                                style: const TextStyle(fontSize: 12),
                              ),
                            ),
                            if (selectedEntry != null)
                              OutlinedButton(
                                onPressed: () {
                                  final data = _roomData
                                      .where(
                                        (d) =>
                                            d.room.id == selectedEntry!.roomId,
                                      )
                                      .firstOrNull;
                                  if (data != null) _openRoomDialog(data);
                                },
                                child: Text(
                                  selectedEntry.seatName.isNotEmpty
                                      ? '좌석 보기'
                                      : '명단 보기',
                                  style: const TextStyle(fontSize: 11),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                )
              else
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      decoration: const InputDecoration(
                        hintText: '이름 또는 학번으로 학생 검색',
                        prefixIcon: Icon(Icons.person_outline, size: 18),
                      ),
                      onChanged: (v) => setState(() => _studentQuery = v),
                    ),
                    if (_studentQuery.trim().isNotEmpty)
                      Container(
                        margin: const EdgeInsets.only(top: 4),
                        constraints: const BoxConstraints(maxHeight: 240),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: Colors.grey.withValues(alpha: 0.2),
                          ),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: studentMatches.isEmpty
                            ? const Padding(
                                padding: EdgeInsets.all(12),
                                child: Text(
                                  '일치하는 학생이 없습니다.',
                                  style: TextStyle(color: Colors.grey),
                                  textAlign: TextAlign.center,
                                ),
                              )
                            : ListView(
                                shrinkWrap: true,
                                children: [
                                  for (final s in studentMatches)
                                    ListTile(
                                      dense: true,
                                      title: Text(
                                        eduset.formatStudentLabel(s),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                        ),
                                      ),
                                      onTap: () =>
                                          setState(() => _selectedStudent = s),
                                    ),
                                ],
                              ),
                      ),
                  ],
                ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: Colors.amber.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.warning_amber,
                        size: 16,
                        color: Colors.amber,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _error!,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.amber.shade800,
                          ),
                        ),
                      ),
                      TextButton(onPressed: _load, child: const Text('다시 시도')),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (sorted.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 48),
                  child: Center(
                    child: Text(
                      _roomData.isEmpty
                          ? '아직 확인 가능한 자습실 데이터가 없습니다.'
                          : '검색 결과가 없습니다.',
                      style: const TextStyle(color: Colors.grey),
                    ),
                  ),
                )
              else
                for (final d in sorted) ...[
                  _RoomRow(
                    data: d,
                    selectedPeriod: _selectedPeriod,
                    onTap: () => _openRoomDialog(d),
                  ),
                  const SizedBox(height: 8),
                ],
            ],
          ),
        ),
      ),
    );
  }
}

class _RoomRow extends StatelessWidget {
  const _RoomRow({
    required this.data,
    required this.selectedPeriod,
    required this.onTap,
  });
  final _RoomData data;
  final int selectedPeriod;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final total = data.seats.length;
    final occupiedCount = data.room.hasSeats
        ? data.occupantsBySeat.values
              .where((l) => l.any((o) => o.period == selectedPeriod))
              .length
        : data.occupancy.where((o) => o.period == selectedPeriod).length;
    final ratio = data.room.hasSeats && total > 0 ? occupiedCount / total : 0.0;
    final highlighted = occupiedCount > 0;
    final clickable = data.room.hasSeats ? total > 0 : true;

    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: InkWell(
        onTap: clickable ? onTap : null,
        child: Opacity(
          opacity: clickable ? 1 : 0.6,
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            data.room.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 13,
                            ),
                          ),
                        ),
                        if (data.room.hasSeats)
                          Text(
                            '$occupiedCount/$total',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                              color: highlighted
                                  ? Theme.of(context).colorScheme.primary
                                  : Colors.grey,
                            ),
                          )
                        else if (data.failed)
                          const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.warning_amber,
                                size: 12,
                                color: Colors.amber,
                              ),
                              SizedBox(width: 4),
                              Text(
                                '조회 실패',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.amber,
                                ),
                              ),
                            ],
                          )
                        else
                          Text(
                            '정원제 · $occupiedCount명 신청',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                              color: highlighted
                                  ? Theme.of(context).colorScheme.primary
                                  : Colors.grey,
                            ),
                          ),
                      ],
                    ),
                    if (data.room.hasSeats)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: ratio.clamp(0, 1),
                            minHeight: 5,
                            backgroundColor: Colors.grey.withValues(
                              alpha: 0.15,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (clickable)
                const Padding(
                  padding: EdgeInsets.only(left: 8),
                  child: Icon(Icons.grid_view, size: 16, color: Colors.grey),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

class _SeatMap extends StatelessWidget {
  const _SeatMap({
    required this.room,
    required this.seats,
    required this.obstacles,
    required this.occupantsBySeat,
    required this.selectedPeriod,
  });
  final eduset.Room room;
  final List<eduset.Seat> seats;
  final List<eduset.Obstacle> obstacles;
  final Map<int, List<_Occupant>> occupantsBySeat;
  final int selectedPeriod;

  static const _cellSize = 44.0;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxHeight: 320),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.withValues(alpha: 0.25)),
        color: Colors.grey.withValues(alpha: 0.04),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SingleChildScrollView(
          child: SizedBox(
            width: room.width * _cellSize,
            height: room.height * _cellSize,
            child: Stack(
              children: [
                for (final ob in obstacles)
                  Positioned(
                    left: ob.x * _cellSize,
                    top: ob.y * _cellSize,
                    width: ob.w * _cellSize,
                    height: ob.h * _cellSize,
                    child: Container(
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: Colors.grey.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(
                          color: Colors.grey.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Text(
                        ob.name,
                        style: const TextStyle(
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                for (final seat in seats) _seatTile(context, seat),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _seatTile(BuildContext context, eduset.Seat seat) {
    final occupants = (occupantsBySeat[seat.id] ?? [])
        .where((o) => o.period == selectedPeriod)
        .toList();
    final occupied = occupants.isNotEmpty;
    final pending =
        occupied &&
        occupants.every((o) => o.status == eduset.SelfStudyStatus.pending);
    final color = pending
        ? Colors.amber
        : (occupied ? Theme.of(context).colorScheme.primary : null);
    return Positioned(
      left: seat.x * _cellSize,
      top: seat.y * _cellSize,
      width: _cellSize - 4,
      height: _cellSize - 4,
      child: Tooltip(
        message: occupied
            ? occupants
                  .map(
                    (o) =>
                        '${o.label}${o.status == eduset.SelfStudyStatus.pending ? ' (대기)' : ''}',
                  )
                  .join(', ')
            : '${seat.name}: 비어있음',
        child: Container(
          alignment: Alignment.center,
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(
              color: color ?? Colors.grey.withValues(alpha: 0.4),
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                seat.name,
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  color: color != null ? Colors.white : Colors.grey,
                ),
              ),
              if (occupied)
                Text(
                  '${occupants.map((o) => o.label).join(', ')}${pending ? ' (대기)' : ''}',
                  style: const TextStyle(
                    fontSize: 7,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CapacityList extends StatelessWidget {
  const _CapacityList({
    required this.occupancy,
    required this.selectedPeriod,
    required this.failed,
    required this.onRetry,
  });
  final List<_OccupancyEntry> occupancy;
  final int selectedPeriod;
  final bool failed;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (failed) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Column(
          children: [
            Text(
              '신청자 명단을 불러오지 못했습니다. 0명이 아니라 조회 실패일 수 있습니다.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.amber.shade800,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: const Text('다시 시도')),
          ],
        ),
      );
    }
    final entries = occupancy.where((o) => o.period == selectedPeriod).toList();
    if (entries.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(
          child: Text('이 교시에 신청자가 없습니다.', style: TextStyle(color: Colors.grey)),
        ),
      );
    }
    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 320),
      child: ListView.separated(
        shrinkWrap: true,
        itemCount: entries.length,
        separatorBuilder: (_, _) => const Divider(height: 1),
        itemBuilder: (context, i) => ListTile(
          dense: true,
          title: Text(
            entries[i].label,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          ),
          trailing: entries[i].status == eduset.SelfStudyStatus.pending
              ? const Text(
                  '대기',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: Colors.amber,
                  ),
                )
              : null,
        ),
      ),
    );
  }
}
