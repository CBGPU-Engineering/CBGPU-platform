import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest_all.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

/// Recurrence for a scheduled alarm.
enum AlarmRepeat { none, daily, weekdays }

AlarmRepeat _repeatFromString(String? value) {
  switch (value) {
    case 'daily':
      return AlarmRepeat.daily;
    case 'weekdays':
      return AlarmRepeat.weekdays;
    default:
      return AlarmRepeat.none;
  }
}

class ScheduledAlarm {
  const ScheduledAlarm({
    required this.id,
    required this.title,
    required this.body,
    required this.when,
    required this.repeat,
  });

  final String id;
  final String title;
  final String body;
  final DateTime when;
  final AlarmRepeat repeat;

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'body': body,
    'whenIso': when.toIso8601String(),
    'repeat': repeat.name,
  };

  factory ScheduledAlarm.fromJson(Map<String, dynamic> json) => ScheduledAlarm(
    id: json['id'] as String,
    title: json['title'] as String,
    body: json['body'] as String,
    when: DateTime.parse(json['whenIso'] as String),
    repeat: _repeatFromString(json['repeat'] as String?),
  );
}

/// Native side of the web↔app "connector": schedules local device
/// notifications that fire even when the WebView/app isn't foregrounded,
/// something the web page alone can never reliably do. The web page drives
/// this entirely through the JS bridge in [WebViewShellScreen] — this class
/// has no UI of its own.
class AlarmService {
  AlarmService._();
  static final AlarmService instance = AlarmService._();

  static const _prefsKey = 'cbgpu_scheduled_alarms';
  static const _channelId = 'cbgpu_alarms';

  final _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    tz_data.initializeTimeZones();
    tz.setLocalLocation(tz.getLocation('Asia/Seoul'));

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _plugin.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
    );

    final androidImpl = _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    await androidImpl?.createNotificationChannel(
      const AndroidNotificationChannel(
        'cbgpu_requests',
        'CBGPU requests',
        description: 'New equipment requests and service updates',
        importance: Importance.high,
      ),
    );
    await androidImpl?.createNotificationChannel(
      const AndroidNotificationChannel(
        _channelId,
        '알람',
        description: 'CBGPU 웹앱에서 설정한 알람',
        importance: Importance.high,
      ),
    );
  }

  /// Show a received push while Android is foregrounded; FCM handles background display.
  Future<void> showPushNotification({
    required String id,
    required String title,
    required String body,
  }) async {
    await init();
    await _plugin.show(
      _notificationId('push-$id'),
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'cbgpu_requests',
          'CBGPU requests',
          channelDescription: 'New equipment requests and service updates',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }

  Future<bool> requestPermission() async {
    await init();
    final androidImpl = _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    if (androidImpl != null) {
      final granted = await androidImpl.requestNotificationsPermission();
      await androidImpl.requestExactAlarmsPermission();
      return granted ?? false;
    }
    final iosImpl = _plugin
        .resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin
        >();
    if (iosImpl != null) {
      final granted = await iosImpl.requestPermissions(
        alert: true,
        badge: true,
        sound: true,
      );
      return granted ?? false;
    }
    return true;
  }

  int _notificationId(String id) => id.hashCode & 0x7fffffff;

  Future<void> scheduleAlarm({
    required String id,
    required String title,
    required String body,
    required DateTime when,
    AlarmRepeat repeat = AlarmRepeat.none,
  }) async {
    await init();

    var scheduled = tz.TZDateTime.from(when, tz.local);
    final now = tz.TZDateTime.now(tz.local);
    if (repeat != AlarmRepeat.none) {
      // Roll a repeating alarm's first fire forward to the next matching
      // slot instead of silently dropping a time that's already passed today.
      while (scheduled.isBefore(now)) {
        scheduled = scheduled.add(const Duration(days: 1));
      }
      if (repeat == AlarmRepeat.weekdays) {
        while (scheduled.weekday > DateTime.friday) {
          scheduled = scheduled.add(const Duration(days: 1));
        }
      }
    }

    await _plugin.zonedSchedule(
      _notificationId(id),
      title,
      body,
      scheduled,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          '알람',
          channelDescription: 'CBGPU 웹앱에서 설정한 알람',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
      matchDateTimeComponents: switch (repeat) {
        AlarmRepeat.daily => DateTimeComponents.time,
        AlarmRepeat.weekdays => DateTimeComponents.dayOfWeekAndTime,
        AlarmRepeat.none => null,
      },
    );

    await _save(
      ScheduledAlarm(
        id: id,
        title: title,
        body: body,
        when: scheduled,
        repeat: repeat,
      ),
    );
  }

  Future<void> cancelAlarm(String id) async {
    await init();
    await _plugin.cancel(_notificationId(id));
    await _remove(id);
  }

  Future<void> cancelAll() async {
    await init();
    await _plugin.cancelAll();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefsKey);
  }

  Future<List<ScheduledAlarm>> listAlarms() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .map((e) => ScheduledAlarm.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (error) {
      debugPrint('AlarmService: failed to decode stored alarms: $error');
      return const [];
    }
  }

  Future<void> _save(ScheduledAlarm alarm) async {
    final prefs = await SharedPreferences.getInstance();
    final current = await listAlarms();
    final next = [...current.where((a) => a.id != alarm.id), alarm];
    await prefs.setString(
      _prefsKey,
      jsonEncode(next.map((a) => a.toJson()).toList()),
    );
  }

  Future<void> _remove(String id) async {
    final prefs = await SharedPreferences.getInstance();
    final current = await listAlarms();
    final next = current.where((a) => a.id != id).toList();
    await prefs.setString(
      _prefsKey,
      jsonEncode(next.map((a) => a.toJson()).toList()),
    );
  }
}
