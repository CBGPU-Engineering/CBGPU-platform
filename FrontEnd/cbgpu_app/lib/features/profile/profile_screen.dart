import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/api_config.dart';
import '../../core/glass.dart';
import '../../core/student_id.dart';
import '../../core/theme.dart';

const _maxAvatarBytes = 5 * 1024 * 1024;

/// Mirrors the web app's canvas-based resizeImageToJpeg: avatars are never
/// rendered above 112px, so downscale + re-encode before upload to cut
/// storage and per-load download size.
Uint8List _resizeToJpeg(
  Uint8List bytes, {
  int maxSize = 256,
  int quality = 85,
}) {
  final decoded = img.decodeImage(bytes);
  if (decoded == null) throw Exception('이미지 처리에 실패했습니다.');
  final resized = img.copyResize(
    decoded,
    width: decoded.width >= decoded.height ? maxSize : null,
    height: decoded.height > decoded.width ? maxSize : null,
    interpolation: img.Interpolation.average,
  );
  return Uint8List.fromList(img.encodeJpg(resized, quality: quality));
}

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _nameController = TextEditingController();
  final _studentIdController = TextEditingController();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  String? _avatarUrl;
  bool _loading = true;
  bool _savingProfile = false;
  bool _uploadingAvatar = false;
  bool _changingPassword = false;
  bool _deletingAccount = false;

  User? get _user => Supabase.instance.client.auth.currentUser;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _studentIdController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    final user = _user;
    if (user == null) {
      setState(() => _loading = false);
      return;
    }
    final data = await Supabase.instance.client
        .from('profiles')
        .select('full_name, student_id, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
    if (!mounted) return;
    setState(() {
      _nameController.text = data?['full_name'] as String? ?? '';
      _studentIdController.text = data?['student_id'] as String? ?? '';
      _avatarUrl = data?['avatar_url'] as String?;
      _loading = false;
    });
  }

  void _snack(String message) {
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    }
  }

  Future<void> _updateProfile() async {
    final user = _user;
    if (user == null) return;
    if (!isValidStudentId(_studentIdController.text)) {
      _snack('학번 형식이 올바르지 않습니다. $studentIdHint');
      return;
    }
    setState(() => _savingProfile = true);
    try {
      await Supabase.instance.client
          .from('profiles')
          .update({
            'student_id': _studentIdController.text.trim(),
            'full_name': _nameController.text.trim(),
          })
          .eq('id', user.id);
      _snack('프로필이 업데이트됐습니다!');
    } catch (e) {
      _snack('업데이트 실패: $e');
    } finally {
      if (mounted) setState(() => _savingProfile = false);
    }
  }

  Future<void> _changePassword() async {
    final user = _user;
    if (user?.email == null) return;
    if (_newPasswordController.text.length < 6) {
      _snack('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (_newPasswordController.text != _confirmPasswordController.text) {
      _snack('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    setState(() => _changingPassword = true);
    try {
      try {
        await Supabase.instance.client.auth.signInWithPassword(
          email: user!.email!,
          password: _currentPasswordController.text,
        );
      } catch (_) {
        _snack('현재 비밀번호가 올바르지 않습니다.');
        return;
      }
      await Supabase.instance.client.auth.updateUser(
        UserAttributes(password: _newPasswordController.text),
      );
      _snack('비밀번호가 변경됐습니다!');
      _currentPasswordController.clear();
      _newPasswordController.clear();
      _confirmPasswordController.clear();
    } catch (e) {
      _snack('비밀번호 변경 실패: $e');
    } finally {
      if (mounted) setState(() => _changingPassword = false);
    }
  }

  Future<void> _pickAvatar() async {
    final user = _user;
    if (user == null) return;
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 95,
    );
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    if (bytes.lengthInBytes > _maxAvatarBytes) {
      _snack('5MB 이하 이미지만 업로드할 수 있습니다.');
      return;
    }
    setState(() => _uploadingAvatar = true);
    try {
      final resized = _resizeToJpeg(bytes);
      final path = '${user.id}/avatar.jpg';
      await Supabase.instance.client.storage
          .from('avatars')
          .uploadBinary(
            path,
            resized,
            fileOptions: const FileOptions(
              upsert: true,
              cacheControl: '3600',
              contentType: 'image/jpeg',
            ),
          );
      final publicUrl = Supabase.instance.client.storage
          .from('avatars')
          .getPublicUrl(path);
      final avatarUrl = '$publicUrl?v=${DateTime.now().millisecondsSinceEpoch}';
      await Supabase.instance.client
          .from('profiles')
          .update({'avatar_url': avatarUrl})
          .eq('id', user.id);
      if (mounted) setState(() => _avatarUrl = avatarUrl);
      _snack('프로필 사진이 변경됐습니다!');
    } catch (e) {
      _snack('업로드 실패: $e');
    } finally {
      if (mounted) setState(() => _uploadingAvatar = false);
    }
  }

  Future<void> _confirmDeleteAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('계정을 삭제할까요?'),
        content: const Text('이름, 학번, 프로필 사진이 삭제되고 다시 로그인할 수 없습니다. 되돌릴 수 없습니다.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('계정 삭제', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed == true) _deleteAccount();
  }

  Future<void> _deleteAccount() async {
    setState(() => _deletingAccount = true);
    try {
      final session = Supabase.instance.client.auth.currentSession;
      final token = session?.accessToken;
      if (token == null) {
        _snack('세션이 만료되었습니다. 다시 로그인해주세요.');
        return;
      }
      final res = await http.post(
        Uri.parse('${ApiConfig.functionsUrl}/account-delete'),
        headers: {'Authorization': 'Bearer $token'},
      );
      final body = res.body.isNotEmpty
          ? jsonDecode(res.body) as Map<String, dynamic>
          : <String, dynamic>{};
      if (res.statusCode != 200) {
        _snack(body['message'] as String? ?? '계정 삭제 실패');
        return;
      }
      await Supabase.instance.client.auth.signOut();
      if (mounted) {
        _snack('계정이 삭제됐습니다.');
        context.go('/');
      }
    } catch (e) {
      _snack('계정 삭제 중 오류가 발생했습니다: $e');
    } finally {
      if (mounted) setState(() => _deletingAccount = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = _user;
    if (_loading) {
      return const AmbientBackground(
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (user == null) {
      return const AmbientBackground(
        child: Center(
          child: Text(
            'Access Denied',
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20),
          ),
        ),
      );
    }

    return AmbientBackground(
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 704),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 40, 16, 112),
            children: [
              GlassCard(
                radius: 40,
                padding: const EdgeInsets.all(32),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final compact = constraints.maxWidth < 560;
                    final avatar = GestureDetector(
                      onTap: _uploadingAvatar ? null : _pickAvatar,
                      child: Stack(
                        children: [
                          // Web: "ring-8 ring-primary/5" — a wide, very
                          // faint primary-tinted ring around the avatar.
                          Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: Theme.of(
                                  context,
                                ).colorScheme.primary.withValues(alpha: 0.05),
                                width: 8,
                              ),
                            ),
                            child: ClipOval(
                              child: _avatarUrl != null
                                  ? Image.network(
                                      _avatarUrl!,
                                      width: 112,
                                      height: 112,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, _, _) =>
                                          _avatarPlaceholder(context),
                                    )
                                  : _avatarPlaceholder(context),
                            ),
                          ),
                          Positioned(
                            bottom: 0,
                            right: 0,
                            // Web: "ring-4 ring-card" — the badge is outlined
                            // in the card's own background so it reads as
                            // sitting on top of the avatar, not overlapping it.
                            child: Container(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: Theme.of(context).colorScheme.surface,
                                  width: 4,
                                ),
                              ),
                              child: CircleAvatar(
                                radius: 18,
                                backgroundColor: Theme.of(
                                  context,
                                ).colorScheme.primary,
                                child: _uploadingAvatar
                                    ? const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      )
                                    : const Icon(
                                        Icons.camera_alt,
                                        size: 16,
                                        color: Colors.white,
                                      ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                    final identity = Column(
                      crossAxisAlignment: compact
                          ? CrossAxisAlignment.center
                          : CrossAxisAlignment.start,
                      children: [
                        Text(
                          (_nameController.text.isEmpty
                                  ? 'Anonymous User'
                                  : _nameController.text)
                              .toUpperCase(),
                          textAlign: compact
                              ? TextAlign.center
                              : TextAlign.left,
                          style: const TextStyle(
                            fontSize: 36,
                            fontWeight: FontWeight.w900,
                            fontStyle: FontStyle.italic,
                            letterSpacing: -1.2,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.mail_outline,
                              size: 12,
                              color: Colors.grey,
                            ),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                user.email ?? '',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.grey,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    );
                    if (compact) {
                      return Column(
                        children: [
                          avatar,
                          const SizedBox(height: 24),
                          identity,
                        ],
                      );
                    }
                    return Row(
                      children: [
                        avatar,
                        const SizedBox(width: 24),
                        Expanded(child: identity),
                      ],
                    );
                  },
                ),
              ),
              const SizedBox(height: 40),
              GlassCard(
                radius: 40,
                padding: const EdgeInsets.all(40),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    FieldLabel(
                      '이름 (Name)',
                      icon: Icons.account_circle_outlined,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    TextField(
                      controller: _nameController,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                      decoration: const InputDecoration(hintText: 'Your Name'),
                    ),
                    const SizedBox(height: 16),
                    FieldLabel(
                      '학번 (Student ID)',
                      icon: Icons.tag,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    TextField(
                      controller: _studentIdController,
                      keyboardType: TextInputType.number,
                      maxLength: 4,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                      decoration: const InputDecoration(
                        hintText: '2309',
                        counterText: '',
                      ),
                    ),
                    Text(
                      studentIdHint,
                      style: const TextStyle(fontSize: 10, color: Colors.grey),
                    ),
                    const SizedBox(height: 16),
                    // Web: "w-full h-16 rounded-2xl font-black text-xl
                    // uppercase tracking-widest shadow-xl shadow-primary/20"
                    // — a big, loud primary CTA. The shared button theme's
                    // 48px/13px default is sized for ordinary toolbar
                    // buttons, not this kind of "main action" button.
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton.icon(
                        onPressed: _savingProfile ? null : _updateProfile,
                        style: ElevatedButton.styleFrom(
                          textStyle: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 15,
                            letterSpacing: 1.2,
                          ),
                        ),
                        icon: _savingProfile
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.save, size: 16),
                        label: Text(
                          (_savingProfile
                                  ? 'Saving Changes...'
                                  : 'Save Profile')
                              .toUpperCase(),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 40),
              GlassCard(
                radius: 40,
                padding: const EdgeInsets.all(40),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.key,
                          size: 18,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          '비밀번호 변경',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    FieldLabel(
                      '현재 비밀번호',
                      icon: Icons.lock_outline,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    TextField(
                      controller: _currentPasswordController,
                      obscureText: true,
                      decoration: const InputDecoration(hintText: '••••••••'),
                    ),
                    const SizedBox(height: 16),
                    FieldLabel(
                      '새 비밀번호',
                      icon: Icons.lock_outline,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    TextField(
                      controller: _newPasswordController,
                      obscureText: true,
                      decoration: const InputDecoration(hintText: '••••••••'),
                    ),
                    const SizedBox(height: 16),
                    FieldLabel(
                      '새 비밀번호 확인',
                      icon: Icons.lock_outline,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    TextField(
                      controller: _confirmPasswordController,
                      obscureText: true,
                      decoration: const InputDecoration(hintText: '••••••••'),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton.icon(
                        onPressed:
                            (_changingPassword ||
                                _currentPasswordController.text.isEmpty ||
                                _newPasswordController.text.isEmpty ||
                                _confirmPasswordController.text.isEmpty)
                            ? null
                            : _changePassword,
                        style: ElevatedButton.styleFrom(
                          textStyle: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 15,
                            letterSpacing: 1.2,
                          ),
                        ),
                        icon: _changingPassword
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.key, size: 16),
                        label: Text(
                          (_changingPassword ? '변경 중...' : '비밀번호 변경')
                              .toUpperCase(),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 40),
              GlassCard(
                radius: 40,
                padding: const EdgeInsets.all(40),
                // Web: "ring-1 ring-destructive/20" — a faint red-tinted
                // ring flagging this card as the danger zone, on top of the
                // same glass every other profile card uses.
                borderColor: Theme.of(
                  context,
                ).colorScheme.error.withValues(alpha: 0.2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.shield_outlined,
                          size: 18,
                          color: Theme.of(context).colorScheme.error,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '위험 구역',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 16,
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      '계정을 삭제하면 로그인할 수 없게 되고 이름, 학번, 프로필 사진이 모두 삭제됩니다. 되돌릴 수 없습니다.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Theme.of(context).colorScheme.error,
                          foregroundColor: Colors.white,
                          textStyle: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 14,
                            letterSpacing: 1.2,
                          ),
                        ),
                        onPressed: _deletingAccount
                            ? null
                            : _confirmDeleteAccount,
                        icon: const Icon(Icons.delete_forever, size: 16),
                        label: Text(
                          (_deletingAccount ? '삭제 중...' : '계정 삭제').toUpperCase(),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _avatarPlaceholder(BuildContext context) {
    return Container(
      width: 112,
      height: 112,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
        shape: BoxShape.circle,
      ),
      child: Icon(
        Icons.person,
        size: 64,
        color: Theme.of(context).colorScheme.primary,
      ),
    );
  }
}
