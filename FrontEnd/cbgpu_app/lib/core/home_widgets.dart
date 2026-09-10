import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:home_widget/home_widget.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:workmanager/workmanager.dart';

import 'api_config.dart';
import 'eduset.dart' as eduset;
import 'locate_student.dart' show parseStudentId;
import 'supabase_config.dart';

/// Path (e.g. `/timetable`) from the most recent home-widget tap, for
/// [WebViewShellScreen] to navigate the WebView to — the app has no native
/// router to hand this to since the [WebViewShellScreen] pivot, so the
/// widget tap and its consumer are decoupled through this notifier instead.
final pendingWidgetPath = ValueNotifier<String?>(null);

/// Six Android home screen widgets (GPU status, 3D printer queue, laser
/// queue, today's meal, today's timetable, self-study status) — data is
/// pushed here from two triggers: whenever the Flutter app runs in the
/// foreground (see [refreshAllHomeWidgets] calls in each relevant screen's
/// initState), and periodically in the background via a WorkManager task
/// registered in [initializeHomeWidgets]. Both paths call the exact same
/// refresh function so there's only one place that decides what a widget
/// shows.
const _refreshTaskName = 'cbgpu-widget-refresh';
const _weekdaysMon = ['월', '화', '수', '목', '금'];

String _timeLabel([DateTime? at]) {
  final d = at ?? DateTime.now();
  return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')} 업데이트';
}

Future<void> _ensureSupabase() async {
  try {
    Supabase.instance.client;
  } catch (_) {
    await Supabase.initialize(url: SupabaseConfig.url, publishableKey: SupabaseConfig.anonKey);
  }
}

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    if (defaultTargetPlatform != TargetPlatform.android) return true;
    try {
      await refreshAllHomeWidgets();
    } catch (_) {
      // Best-effort background refresh — a failed fetch just leaves the
      // widget showing its last known state until the next cycle.
    }
    return true;
  });
}

/// Call once at app startup (Android only, after Supabase.initialize) —
/// registers the periodic background refresh. 30 minutes is WorkManager's
/// practical floor for anything close to reliable on stock Android; Doze
/// mode can still delay it further, which is fine for glanceable data like
/// this.
Future<void> initializeHomeWidgets() async {
  if (defaultTargetPlatform != TargetPlatform.android) return;
  await Workmanager().initialize(callbackDispatcher);
  await Workmanager().registerPeriodicTask(
    _refreshTaskName,
    _refreshTaskName,
    frequency: const Duration(minutes: 30),
    existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
  );

  HomeWidget.widgetClicked.listen((uri) => _handleWidgetLaunch(uri));
  final initialUri = await HomeWidget.initiallyLaunchedFromHomeWidget();
  _handleWidgetLaunch(initialUri);
}

void _handleWidgetLaunch(Uri? uri) {
  if (uri == null || uri.path.isEmpty) return;
  pendingWidgetPath.value = uri.path;
}

/// Fetches fresh data for all six widgets and pushes it to their native
/// providers. Safe to call with no logged-in user — the widgets that need a
/// session (printer/laser/timetable/self-study) just show a "로그인 필요" state.
Future<void> refreshAllHomeWidgets() async {
  if (defaultTargetPlatform != TargetPlatform.android) return;
  await _ensureSupabase();

  await Future.wait([
    _refreshGpuStatus(),
    _refreshPrinter3d(),
    _refreshLaser(),
    _refreshMeal(),
    _refreshTimetable(),
    _refreshSelfStudy(),
  ]);
}

Future<void> _save(String prefix, String body) async {
  await HomeWidget.saveWidgetData('$prefix.body', body);
  await HomeWidget.saveWidgetData('$prefix.updatedAt', _timeLabel());
}

Future<void> _refreshGpuStatus() async {
  try {
    final res = await http.get(Uri.parse('${ApiConfig.functionsUrl}/gpu-status')).timeout(const Duration(seconds: 12));
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final gpus = (body['gpus'] as List).cast<Map<String, dynamic>>();
    final text = gpus.map((g) => 'GPU${g['id']} ${g['status'] == 'online' ? '켜짐' : '꺼짐'}').join('\n');
    await _save('gpu_status', text.isEmpty ? '정보 없음' : text);
    await HomeWidget.updateWidget(androidName: 'GpuStatusWidgetProvider');
  } catch (_) {
    await _save('gpu_status', '불러오기 실패');
    await HomeWidget.updateWidget(androidName: 'GpuStatusWidgetProvider');
  }
}

Future<void> _refreshPrinter3d() async {
  final user = Supabase.instance.client.auth.currentUser;
  if (user == null) {
    await _save('printer3d', '로그인 필요');
    await HomeWidget.updateWidget(androidName: 'Printer3dWidgetProvider');
    return;
  }
  try {
    final rows = await Supabase.instance.client.from('printers').select('name, status').order('id', ascending: true);
    const labels = {'idle': '대기', 'printing': '사용중', 'done': '회수대기', 'maintenance': '고장'};
    final text = (rows as List).map((p) => '${p['name']} ${labels[p['status']] ?? p['status']}').join('\n');
    await _save('printer3d', text.isEmpty ? '등록된 프린터 없음' : text);
  } catch (_) {
    await _save('printer3d', '불러오기 실패');
  }
  await HomeWidget.updateWidget(androidName: 'Printer3dWidgetProvider');
}

Future<void> _refreshLaser() async {
  final user = Supabase.instance.client.auth.currentUser;
  if (user == null) {
    await _save('laser', '로그인 필요');
    await HomeWidget.updateWidget(androidName: 'LaserWidgetProvider');
    return;
  }
  try {
    final rows = await Supabase.instance.client.from('laser_jobs').select('id').inFilter('status', ['pending', 'accepted', 'in_progress']);
    final count = (rows as List).length;
    await _save('laser', count == 0 ? '대기열 없음' : '대기열 $count건');
  } catch (_) {
    await _save('laser', '불러오기 실패');
  }
  await HomeWidget.updateWidget(androidName: 'LaserWidgetProvider');
}

Future<void> _refreshMeal() async {
  try {
    final res = await http.get(Uri.parse('${ApiConfig.functionsUrl}/meal')).timeout(const Duration(seconds: 12));
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final meals = (body['meals'] as List? ?? []).cast<Map<String, dynamic>>();
    if (meals.isEmpty) {
      await _save('meal', '급식 정보 없음');
    } else {
      final text = meals.map((m) => '${m['type']}: ${(m['items'] as List).take(3).join(', ')}').join('\n');
      await _save('meal', text);
    }
  } catch (_) {
    await _save('meal', '불러오기 실패');
  }
  await HomeWidget.updateWidget(androidName: 'MealWidgetProvider');
}

Future<void> _refreshTimetable() async {
  final user = Supabase.instance.client.auth.currentUser;
  if (user == null) {
    await _save('timetable', '로그인 필요');
    await HomeWidget.updateWidget(androidName: 'TimetableWidgetProvider');
    return;
  }
  try {
    final profile = await Supabase.instance.client.from('profiles').select('student_id').eq('id', user.id).maybeSingle();
    final identity = parseStudentId(profile?['student_id'] as String?);
    if (identity == null) {
      await _save('timetable', '학번 정보 없음');
      await HomeWidget.updateWidget(androidName: 'TimetableWidgetProvider');
      return;
    }
    final now = DateTime.now();
    final gridDay = now.weekday - 1; // 0=Mon..4=Fri
    if (gridDay < 0 || gridDay > 4) {
      await _save('timetable', '오늘은 수업이 없습니다');
      await HomeWidget.updateWidget(androidName: 'TimetableWidgetProvider');
      return;
    }
    final res = await http.get(Uri.parse('${ApiConfig.functionsUrl}/timetable?grade=${identity.grade}&class=${identity.classNo}')).timeout(const Duration(seconds: 12));
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final grid = body['grid'] as Map<String, dynamic>?;
    final dayGrid = grid?['$gridDay'] as Map<String, dynamic>?;
    if (dayGrid == null || dayGrid.isEmpty) {
      await _save('timetable', '${_weekdaysMon[gridDay]}요일 시간표 없음');
    } else {
      final periods = dayGrid.keys.map(int.parse).toList()..sort();
      final text = periods.take(6).map((p) => '$p.${(dayGrid['$p'] as Map<String, dynamic>)['subject']}').join(' · ');
      await _save('timetable', text);
    }
  } catch (_) {
    await _save('timetable', '불러오기 실패');
  }
  await HomeWidget.updateWidget(androidName: 'TimetableWidgetProvider');
}

Future<void> _refreshSelfStudy() async {
  final user = Supabase.instance.client.auth.currentUser;
  if (user == null) {
    await _save('selfstudy', '로그인 필요');
    await HomeWidget.updateWidget(androidName: 'SelfStudyWidgetProvider');
    return;
  }
  try {
    final profile = await Supabase.instance.client.from('profiles').select('student_id').eq('id', user.id).maybeSingle();
    final identity = parseStudentId(profile?['student_id'] as String?);
    if (identity == null) {
      await _save('selfstudy', '학번 정보 없음');
      await HomeWidget.updateWidget(androidName: 'SelfStudyWidgetProvider');
      return;
    }
    final entries = await eduset.searchSelfStudy(eduset.localDateStr());
    final mine = entries.where((e) => e.student.grade == identity.grade && e.student.classNo == identity.classNo && e.student.number == identity.number).toList();
    if (mine.isEmpty) {
      await _save('selfstudy', '오늘 자습신청 안 함');
    } else {
      final periods = mine.map((e) => '${e.period}교시').join(', ');
      await _save('selfstudy', '신청 완료 ($periods)');
    }
  } catch (_) {
    await _save('selfstudy', '불러오기 실패');
  }
  await HomeWidget.updateWidget(androidName: 'SelfStudyWidgetProvider');
}
