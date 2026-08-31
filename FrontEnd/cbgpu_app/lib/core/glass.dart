import 'dart:ui';

import 'package:flutter/material.dart';

/// The single top glow from the web app's body background (globals.css:
/// radial-gradient(ellipse 80% 50% at 50% -10%, primary/0.12|0.2, transparent 70%)).
/// Wrap a Scaffold's body with this so every screen has the same ambient wash
/// the CSS glass utilities were designed to catch.
class AmbientBackground extends StatelessWidget {
  const AmbientBackground({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Stack(
      fit: StackFit.expand,
      children: [
        Container(color: Theme.of(context).canvasColor),
        Positioned(
          top: -200,
          left: -100,
          right: -100,
          height: 500,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                colors: [
                  const Color(0xFF0082E6).withValues(alpha: isDark ? 0.20 : 0.12),
                  const Color(0xFF0082E6).withValues(alpha: 0),
                ],
                stops: const [0.0, 1.0],
              ),
            ),
          ),
        ),
        child,
      ],
    );
  }
}

/// Frosted-glass content container matching the web app's `--card` token:
/// translucent background + backdrop blur + saturation boost + soft
/// specular highlight at the top edge. High enough opacity that text never
/// fights with whatever's blurred behind it (same lesson as the CSS version).
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(24),
    this.radius = 28,
  });

  final Widget child;
  final EdgeInsets padding;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final base = Theme.of(context).colorScheme.surface;
    final border = Theme.of(context).dividerColor;

    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(color: border),
            // Spread across the full height (not just the top 40%) — on a
            // short, wide element like the bottom nav bar, concentrating the
            // transition into a small pixel band read as an odd stripe
            // rather than an ambient sheen. Full-height + a lower peak alpha
            // looks consistent whether the card is short or tall.
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.white.withValues(alpha: isDark ? 0.05 : 0.28),
                base.withValues(alpha: isDark ? 0.78 : 0.82),
              ],
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.4 : 0.06),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: child,
        ),
      ),
    );
  }
}
