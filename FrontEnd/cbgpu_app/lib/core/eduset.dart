import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import 'api_config.dart';

/// cbsh.edu-set.com (학생관리시스템) read-only client, mirroring the web
/// app's src/lib/eduset.ts. The Next.js /api/study/proxy route always uses
/// an admin-registered SHARED token for every caller (see that route's own
/// comment) — the only thing a caller needs is a valid CBGPU session, sent
/// as x-cbgpu-auth. There is no per-user eduset sign-in for this read-only
/// status viewer, so this client only implements the GET/search calls the
/// Study page actually uses.
class EdusetError implements Exception {
  EdusetError(this.message);
  final String message;
  @override
  String toString() => message;
}

class Student {
  Student({
    required this.id,
    required this.name,
    this.grade,
    this.classNo,
    this.number,
  });
  final int id;
  final String name;
  final int? grade;
  final int? classNo;
  final int? number;

  factory Student.fromJson(Map<String, dynamic> j) => Student(
    id: j['id'] as int,
    name: j['name'] as String? ?? '',
    grade: j['grade'] as int?,
    classNo: j['classNo'] as int?,
    number: j['number'] as int?,
  );
}

String formatStudentLabel(Student s) {
  if (s.grade == null || s.classNo == null || s.number == null) return s.name;
  final n = s.grade! * 1000 + s.classNo! * 100 + s.number!;
  return '$n ${s.name}';
}

class Room {
  Room({
    required this.id,
    required this.name,
    required this.width,
    required this.height,
    required this.hasSeats,
  });
  final int id;
  final String name;
  final int width;
  final int height;
  final bool hasSeats;

  factory Room.fromJson(Map<String, dynamic> j) => Room(
    id: j['id'] as int,
    name: j['name'] as String? ?? '',
    width: j['width'] as int? ?? 0,
    height: j['height'] as int? ?? 0,
    hasSeats: j['hasSeats'] as bool? ?? false,
  );
}

class Seat {
  Seat({
    required this.id,
    required this.x,
    required this.y,
    required this.name,
  });
  final int id;
  final num x;
  final num y;
  final String name;
  factory Seat.fromJson(Map<String, dynamic> j) => Seat(
    id: j['id'] as int,
    x: j['x'] as num,
    y: j['y'] as num,
    name: j['name'] as String? ?? '',
  );
}

class Obstacle {
  Obstacle({
    required this.id,
    required this.x,
    required this.y,
    required this.w,
    required this.h,
    required this.name,
  });
  final int id;
  final num x, y, w, h;
  final String name;
  factory Obstacle.fromJson(Map<String, dynamic> j) => Obstacle(
    id: j['id'] as int,
    x: j['x'] as num,
    y: j['y'] as num,
    w: j['w'] as num,
    h: j['h'] as num,
    name: j['name'] as String? ?? '',
  );
}

class RoomComposition {
  RoomComposition(this.seats, this.obstacles);
  final List<Seat> seats;
  final List<Obstacle> obstacles;
}

class SeatOccupation {
  SeatOccupation({
    required this.seatId,
    required this.period,
    required this.studentId,
  });
  final int seatId;
  final int period;
  final int studentId;
  factory SeatOccupation.fromJson(Map<String, dynamic> j) => SeatOccupation(
    seatId: j['seatId'] as int,
    period: j['period'] as int,
    studentId: j['studentId'] as int,
  );
}

enum SelfStudyStatus { pending, approved, rejected }

SelfStudyStatus _parseStatus(String? s) => switch (s) {
  'PENDING' => SelfStudyStatus.pending,
  'REJECTED' => SelfStudyStatus.rejected,
  _ => SelfStudyStatus.approved,
};

class SelfStudyEntry {
  SelfStudyEntry({
    required this.type,
    required this.period,
    required this.status,
    required this.student,
    required this.roomId,
    required this.roomName,
    this.seatId,
    this.seatName,
  });
  final String type;
  final int period;
  final SelfStudyStatus status;
  final Student student;
  final int roomId;
  final String roomName;
  final int? seatId;
  final String? seatName;

  factory SelfStudyEntry.fromJson(Map<String, dynamic> j) {
    final seat = j['seat'] as Map<String, dynamic>?;
    return SelfStudyEntry(
      type: j['type'] as String? ?? '',
      period: j['period'] as int,
      status: _parseStatus(j['status'] as String?),
      student: Student.fromJson(j['student'] as Map<String, dynamic>),
      roomId: (j['room'] as Map<String, dynamic>)['id'] as int,
      roomName: (j['room'] as Map<String, dynamic>)['name'] as String? ?? '',
      seatId: seat?['id'] as int?,
      seatName: seat?['name'] as String?,
    );
  }
}

class SelfStudyPolicy {
  SelfStudyPolicy(this.presets, this.assign, this.exception);
  final Map<String, dynamic> presets;
  final Map<String, dynamic> assign;
  final Map<String, dynamic> exception;
}

String localDateStr([DateTime? date]) {
  final d = date ?? DateTime.now();
  return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

int getPeriodCountForDate(SelfStudyPolicy policy, DateTime date) {
  final presetKey =
      policy.exception[localDateStr(date)] ??
      policy.assign['${date.weekday % 7}'];
  if (presetKey == null) return 0;
  final preset = policy.presets[presetKey];
  return preset is List ? preset.length : 0;
}

Future<T> _apiFetch<T>(
  String path,
  T Function(dynamic) parse, {
  String method = 'GET',
  Object? body,
}) async {
  final session = Supabase.instance.client.auth.currentSession;
  if (session == null) throw EdusetError('로그인이 필요합니다.');

  final uri = Uri.parse('${ApiConfig.functionsUrl}/study-proxy$path');
  final headers = {
    'Content-Type': 'application/json',
    'x-cbgpu-auth': 'Bearer ${session.accessToken}',
  };
  final res = method == 'GET'
      ? await http
            .get(uri, headers: headers)
            .timeout(const Duration(seconds: 10))
      : await http
            .post(
              uri,
              headers: headers,
              body: body != null ? jsonEncode(body) : null,
            )
            .timeout(const Duration(seconds: 10));

  if (res.statusCode < 200 || res.statusCode >= 300) {
    final decoded = () {
      try {
        return jsonDecode(res.body) as Map<String, dynamic>;
      } catch (_) {
        return null;
      }
    }();
    throw EdusetError(
      decoded?['message'] as String? ?? '요청 실패 (HTTP ${res.statusCode})',
    );
  }
  if (res.body.isEmpty) return parse(null);
  return parse(jsonDecode(res.body));
}

Future<List<Room>> getRooms() => _apiFetch(
  '/rooms',
  (j) =>
      (j as List).map((r) => Room.fromJson(r as Map<String, dynamic>)).toList(),
);

Future<List<Student>> getStudents() => _apiFetch(
  '/students',
  (j) => (j as List)
      .map((r) => Student.fromJson(r as Map<String, dynamic>))
      .toList(),
);

final Map<int, Future<Student>> _studentCache = {};
Future<Student> getStudent(int id) => _studentCache.putIfAbsent(
  id,
  () => _apiFetch(
    '/students/$id',
    (j) => Student.fromJson(j as Map<String, dynamic>),
  ),
);

Future<SelfStudyPolicy> getSelfStudyPolicy() =>
    _apiFetch('/policies/selfstudy', (j) {
      final data = (j as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      final timetable = data['timetable'] as Map<String, dynamic>;
      return SelfStudyPolicy(
        timetable['presets'] as Map<String, dynamic>? ?? {},
        timetable['assign'] as Map<String, dynamic>? ?? {},
        timetable['exception'] as Map<String, dynamic>? ?? {},
      );
    });

Future<RoomComposition> getRoomComposition(int roomId) =>
    _apiFetch('/rooms/$roomId/composition', (j) {
      final m = j as Map<String, dynamic>;
      return RoomComposition(
        (m['seats'] as List)
            .map((s) => Seat.fromJson(s as Map<String, dynamic>))
            .toList(),
        (m['obstacles'] as List)
            .map((o) => Obstacle.fromJson(o as Map<String, dynamic>))
            .toList(),
      );
    });

Future<List<SeatOccupation>> getSeatOccupations(int roomId, String dateStr) =>
    _apiFetch(
      '/rooms/$roomId/seats/occupations?date=$dateStr',
      (j) => (j as List)
          .map((o) => SeatOccupation.fromJson(o as Map<String, dynamic>))
          .toList(),
    );

Future<List<SelfStudyEntry>> searchSelfStudy(String dateStr) => _apiFetch(
  '/selfstudy/search',
  (j) => (j as List)
      .map((e) => SelfStudyEntry.fromJson(e as Map<String, dynamic>))
      .toList(),
  method: 'POST',
  body: {'date': dateStr},
);
