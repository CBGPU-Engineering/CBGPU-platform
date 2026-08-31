import 'package:flutter/material.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/home_widgets.dart';
import 'core/router.dart';
import 'core/supabase_config.dart';
import 'core/theme.dart';
import 'core/theme_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Match the React routes exactly so recovery links and refreshed nested
  // pages do not get reinterpreted as /#/ routes by the web build.
  usePathUrlStrategy();
  await Supabase.initialize(
    url: SupabaseConfig.url,
    publishableKey: SupabaseConfig.anonKey,
  );
  await initializeHomeWidgets();
  runApp(const CbgpuApp());
}

class CbgpuApp extends StatelessWidget {
  const CbgpuApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeModeNotifier,
      builder: (context, mode, _) => MaterialApp.router(
        title: 'CBGPU',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: mode,
        routerConfig: router,
      ),
    );
  }
}
