import 'package:flutter/material.dart';

import 'motion.dart';
import 'theme.dart';

/// One tab in [AppSegmentedTabs]. `builder` receives whether this tab is
/// currently active so screens with two-line labels (title + small
/// description) can style both lines themselves, matching how the web's
/// `SegmentedTabItem.label` accepts arbitrary ReactNode content.
class AppTabItem<T> {
  const AppTabItem({required this.value, required this.builder});
  final T value;
  final Widget Function(bool active) builder;
}

/// Ports the web app's shared `SegmentedTabs` (src/components/ui/segmented-
/// tabs.tsx): a sliding `primary`-colored pill behind the active tab,
/// animated with the same spring curve as the site's
/// `ease-[var(--ease-spring)]`, replacing the stock `SegmentedButton`/
/// `ChoiceChip` screens were using for tab switching (which look and animate
/// nothing like the site's tabs). Selection-type chips (e.g. picking a poll
/// answer) are a different UI pattern on the web too and should stay as
/// `ChoiceChip` — this is only for switching between views.
class AppSegmentedTabs<T> extends StatefulWidget {
  const AppSegmentedTabs({
    super.key,
    required this.items,
    required this.value,
    required this.onChanged,
    this.pill = false,
  });

  final List<AppTabItem<T>> items;
  final T value;
  final ValueChanged<T> onChanged;
  final bool pill;

  @override
  State<AppSegmentedTabs<T>> createState() => _AppSegmentedTabsState<T>();
}

class _AppSegmentedTabsState<T> extends State<AppSegmentedTabs<T>> {
  final _stackKey = GlobalKey();
  final Map<T, GlobalKey> _itemKeys = {};
  Rect? _indicator;

  GlobalKey _keyFor(T value) => _itemKeys.putIfAbsent(value, () => GlobalKey());

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _measure());
  }

  @override
  void didUpdateWidget(covariant AppSegmentedTabs<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    WidgetsBinding.instance.addPostFrameCallback((_) => _measure());
  }

  void _measure() {
    final stackBox =
        _stackKey.currentContext?.findRenderObject() as RenderBox?;
    final itemBox =
        _itemKeys[widget.value]?.currentContext?.findRenderObject()
            as RenderBox?;
    if (stackBox == null ||
        itemBox == null ||
        !stackBox.hasSize ||
        !itemBox.hasSize) {
      return;
    }
    final offset = itemBox.localToGlobal(Offset.zero, ancestor: stackBox);
    final rect = offset & itemBox.size;
    if (rect != _indicator && mounted) {
      setState(() => _indicator = rect);
    }
  }

  @override
  Widget build(BuildContext context) {
    final radius = widget.pill ? 999.0 : 10.0;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Stack(
        key: _stackKey,
        children: [
          AnimatedPositioned(
            duration: const Duration(milliseconds: 300),
            curve: springCurve,
            left: _indicator?.left ?? 0,
            top: _indicator?.top ?? 0,
            width: _indicator?.width ?? 0,
            height: _indicator?.height ?? 0,
            child: AnimatedOpacity(
              opacity: _indicator == null ? 0 : 1,
              duration: const Duration(milliseconds: 150),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(radius),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.15),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final item in widget.items)
                Padding(
                  padding: const EdgeInsets.only(right: 4),
                  child: Material(
                    key: _keyFor(item.value),
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(radius),
                    // A fallback fill on the active tab itself, so if
                    // measurement ever fails (e.g. first frame before
                    // layout) the active tab still reads as selected instead
                    // of silently losing its background — same guarantee the
                    // web version's comment calls out.
                    child: Ink(
                      decoration: BoxDecoration(
                        color: item.value == widget.value && _indicator == null
                            ? AppColors.primary
                            : null,
                        borderRadius: BorderRadius.circular(radius),
                      ),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(radius),
                        onTap: () => widget.onChanged(item.value),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          child: DefaultTextStyle.merge(
                            style: TextStyle(
                              color: item.value == widget.value
                                  ? Colors.white
                                  : Theme.of(
                                      context,
                                    ).colorScheme.onSurface.withValues(alpha: 0.6),
                            ),
                            child: item.builder(item.value == widget.value),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
