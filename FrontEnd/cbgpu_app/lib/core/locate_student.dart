import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'eduset.dart' as eduset;

/// Port of src/lib/manufacturing/locateStudent.ts — "where is this student
/// right now", used so a manufacturing manager can hand over a finished
/// print/cut in person. Same two-source logic: the shared self-study lookup
/// during a self-study period (per the school's actual bell schedule, not
/// scraped), homeroom via comcigan otherwise.

class StudentIdentity {
  StudentIdentity(this.grade, this.classNo, this.number);
  final int grade;
  final int classNo;
  final int number;
}

StudentIdentity? parseStudentId(String? studentId) {
  if (studentId == null) return null;
  final n = int.tryParse(studentId);
  if (n == null || n < 1101) return null;
  final grade = n ~/ 1000;
  final rest = n % 1000;
  final classNo = rest ~/ 100;
  final number = rest % 100;
  if (grade < 1 || grade > 3 || classNo < 1 || classNo > 20 || number < 1 || number > 40) return null;
  return StudentIdentity(grade, classNo, number);
}

class _ClassPeriodTime {
  _ClassPeriodTime(this.period, this.startMinutes);
  final int period;
  final int startMinutes;
}

List<_ClassPeriodTime> _parseClassTimes(List<dynamic> times) {
  final out = <_ClassPeriodTime>[];
  final re = RegExp(r'^(\d+)\((\d{1,2}):(\d{2})\)');
  for (final t in times) {
    final m = re.firstMatch(t.toString());
    if (m == null) continue;
    out.add(_ClassPeriodTime(int.parse(m.group(1)!), int.parse(m.group(2)!) * 60 + int.parse(m.group(3)!)));
  }
  out.sort((a, b) => a.startMinutes.compareTo(b.startMinutes));
  return out;
}

const _assumedClassPeriodMinutes = 50;

class _SelfStudyPeriodTime {
  const _SelfStudyPeriodTime(this.period, this.startMinutes, this.endMinutes);
  final int period;
  final int startMinutes;
  final int endMinutes;
}

const _weekendSelfStudy = [
  _SelfStudyPeriodTime(1, 515, 565), // 08:35-09:25
  _SelfStudyPeriodTime(2, 575, 625), // 09:35-10:25
  _SelfStudyPeriodTime(3, 635, 685), // 10:35-11:25
  _SelfStudyPeriodTime(4, 695, 745), // 11:35-12:25
  _SelfStudyPeriodTime(5, 840, 930), // 14:00-15:30
  _SelfStudyPeriodTime(6, 960, 1050), // 16:00-17:30
  _SelfStudyPeriodTime(7, 1140, 1220), // 19:00-20:20
  _SelfStudyPeriodTime(8, 1240, 1310), // 20:40-21:50
];

const _weekdaySelfStudy = [
  _SelfStudyPeriodTime(1, 1005, 1080), // 16:45-18:00
  _SelfStudyPeriodTime(2, 1140, 1220), // 19:00-20:20
  _SelfStudyPeriodTime(3, 1240, 1310), // 20:40-21:50
];

List<_SelfStudyPeriodTime> _scheduleFor(int jsDay) => switch (jsDay) {
      0 || 6 => _weekendSelfStudy,
      _ => _weekdaySelfStudy,
    };

sealed class LocationResult {}

class ClassLocation extends LocationResult {
  ClassLocation(this.identity, {this.period, this.subject});
  final StudentIdentity identity;
  final int? period;
  final String? subject;
}

class SelfStudyLocation extends LocationResult {
  SelfStudyLocation(this.identity, this.period, this.roomName, this.seatName);
  final StudentIdentity identity;
  final int period;
  final String roomName;
  final String? seatName;
}

class NoSelfStudyLocation extends LocationResult {
  NoSelfStudyLocation(this.identity, this.period);
  final StudentIdentity identity;
  final int period;
}

Future<LocationResult?> locateStudentNow(String? studentId) async {
  final identity = parseStudentId(studentId);
  if (identity == null) return null;

  final now = DateTime.now();
  final jsDay = now.weekday % 7; // Dart: Mon=1..Sun=7 -> JS: Sun=0..Sat=6
  final gridDay = jsDay - 1; // 0 Mon .. 4 Fri
  final nowMinutes = now.hour * 60 + now.minute;

  final todaySchedule = _scheduleFor(jsDay);
  _SelfStudyPeriodTime? currentPeriod;
  for (final p in todaySchedule) {
    if (nowMinutes >= p.startMinutes && nowMinutes < p.endMinutes) {
      currentPeriod = p;
      break;
    }
  }

  if (currentPeriod != null) {
    try {
      final entries = await eduset.searchSelfStudy(eduset.localDateStr(now));
      final mine = entries.where((e) => e.period == currentPeriod!.period && e.student.grade == identity.grade && e.student.classNo == identity.classNo && e.student.number == identity.number).toList();
      if (mine.isNotEmpty) {
        final e = mine.first;
        return SelfStudyLocation(identity, currentPeriod.period, e.roomName, e.seatName);
      }
      return NoSelfStudyLocation(identity, currentPeriod.period);
    } catch (_) {
      // fall through to homeroom default
    }
  }

  if (gridDay >= 0 && gridDay <= 4) {
    try {
      final res = await http.get(Uri.parse('${ApiConfig.baseUrl}/api/timetable?grade=${identity.grade}&class=${identity.classNo}')).timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final periods = _parseClassTimes(data['times'] as List? ?? []);
        for (var i = 0; i < periods.length; i++) {
          final start = periods[i].startMinutes;
          final end = i + 1 < periods.length ? periods[i + 1].startMinutes : start + _assumedClassPeriodMinutes;
          if (nowMinutes >= start && nowMinutes < end) {
            final grid = data['grid'] as Map<String, dynamic>?;
            final cell = (grid?['$gridDay'] as Map<String, dynamic>?)?['${periods[i].period}'] as Map<String, dynamic>?;
            if (cell != null) return ClassLocation(identity, period: periods[i].period, subject: cell['subject'] as String?);
            break;
          }
        }
      }
    } catch (_) {
      // comcigan is a scraped third-party site and can be flaky — fall through to homeroom
    }
  }

  return ClassLocation(identity);
}
