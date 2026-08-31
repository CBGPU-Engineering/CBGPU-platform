import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../firebase_options.dart';

/// Firebase is only configured for Android (see flutterfire configure run) —
/// iOS would talk to APNs directly and Web would use standard Web Push, per
/// the "Firebase only where it's actually required" call made for this app.
/// Call once after Supabase's session is available (see HomeScreen).
Future<void> registerDeviceForPushNotifications() async {
  if (defaultTargetPlatform != TargetPlatform.android) return;

  final user = Supabase.instance.client.auth.currentUser;
  if (user == null) return;

  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  }

  final messaging = FirebaseMessaging.instance;
  final settings = await messaging.requestPermission();
  if (settings.authorizationStatus == AuthorizationStatus.denied) return;

  final token = await messaging.getToken();
  if (token != null) {
    await _upsertToken(token);
  }

  messaging.onTokenRefresh.listen(_upsertToken);
}

Future<void> _upsertToken(String token) async {
  final user = Supabase.instance.client.auth.currentUser;
  if (user == null) return;
  await Supabase.instance.client.from('device_tokens').upsert(
    {'user_id': user.id, 'token': token, 'platform': 'android'},
    onConflict: 'token',
  );
}
