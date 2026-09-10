import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../firebase_options.dart';

/// FCM on both Android and iOS (Web has no native shell to register a
/// device token for — see [WebViewShellScreen], the whole app is a WebView
/// of the site there). iOS delivery additionally needs an APNs Auth Key
/// uploaded in the Firebase console (Project Settings > Cloud Messaging) —
/// that's an Apple Developer Program credential this codebase can't carry,
/// so until it's set up iOS registration will get a token but the
/// server-side notify-* Edge Functions won't be able to actually deliver to
/// it.
/// Call once the native Supabase client has a session — see webview_shell's
/// syncSession bridge handler, the only place that's currently true now
/// that sign-in happens inside the WebView, not a native screen.
Future<void> registerDeviceForPushNotifications() async {
  if (kIsWeb) return;
  if (defaultTargetPlatform != TargetPlatform.android &&
      defaultTargetPlatform != TargetPlatform.iOS) {
    return;
  }

  final user = Supabase.instance.client.auth.currentUser;
  if (user == null) return;

  try {
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
    }

    final messaging = FirebaseMessaging.instance;
    final settings = await messaging.requestPermission();
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    if (defaultTargetPlatform == TargetPlatform.iOS) {
      // getToken() on iOS needs an APNs token registered first; that
      // registration is async and not guaranteed to have landed the instant
      // requestPermission()'s future completes, so poll briefly rather than
      // assuming it's ready.
      for (var attempt = 0; attempt < 10; attempt++) {
        if (await messaging.getAPNSToken() != null) break;
        await Future<void>.delayed(const Duration(milliseconds: 500));
      }
    }

    final token = await messaging.getToken();
    if (token != null) {
      await _upsertToken(token);
    }

    _tokenRefreshSubscription ??= messaging.onTokenRefresh.listen(
      (token) => _upsertToken(token),
      onError: (Object error, StackTrace stackTrace) {
        debugPrint('FCM token refresh failed: $error');
      },
    );
  } catch (error, stackTrace) {
    // Push registration must never prevent the rest of the app from working
    // (for example on Android devices without Google Play Services).
    debugPrint('Push notification registration failed: $error');
    debugPrintStack(stackTrace: stackTrace);
  }
}

StreamSubscription<String>? _tokenRefreshSubscription;

Future<void> _upsertToken(String token) async {
  final user = Supabase.instance.client.auth.currentUser;
  if (user == null) return;
  await Supabase.instance.client.from('device_tokens').upsert({
    'user_id': user.id,
    'token': token,
    'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
  }, onConflict: 'token');
}
