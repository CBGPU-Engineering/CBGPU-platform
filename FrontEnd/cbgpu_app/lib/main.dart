import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/router.dart';
import 'core/supabase_config.dart';
import 'core/theme.dart';
import 'core/theme_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(url: SupabaseConfig.url, publishableKey: SupabaseConfig.anonKey);
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
