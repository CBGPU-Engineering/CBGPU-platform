/// Same rule as the web app's src/lib/studentId.ts — 4 digits: grade(1-3) +
/// class(1-3) + number(00-99, any two digits).
final _studentIdPattern = RegExp(r'^[1-3][1-3]\d{2}$');

bool isValidStudentId(String value) => _studentIdPattern.hasMatch(value.trim());

const studentIdHint = '학번 4자리 (예: 2309 = 2학년 3반 9번)';
