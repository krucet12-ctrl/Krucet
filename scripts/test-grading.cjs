function requiredExternalMarks(intMarks) {
  const im = Number.isFinite(intMarks) ? Math.max(0, Math.min(25, Math.round(intMarks))) : 0;
  const deficit = Math.max(0, 15 - im);
  const req = 25 + deficit;
  return Math.min(75, Math.max(0, req));
}

function isSubjectPassed(intMarks, extMarks, totalMarks, maxMarks = 100) {
  if (maxMarks === 100) {
    const requiredExt = requiredExternalMarks(intMarks);
    return Number.isFinite(extMarks) && extMarks >= requiredExt;
  }
  const passThreshold = maxMarks * 0.4;
  return Number.isFinite(totalMarks) && totalMarks >= passThreshold;
}

const cases = [
  { int: 15, ext: 25, expectedReq: 25, expectedPass: true },
  { int: 18, ext: 25, expectedReq: 25, expectedPass: true },
  { int: 13, ext: 27, expectedReq: 27, expectedPass: true },
  { int: 14, ext: 26, expectedReq: 26, expectedPass: true },
  { int: 10, ext: 30, expectedReq: 30, expectedPass: true },
  { int: 13, ext: 26, expectedReq: 27, expectedPass: false },
  { int: 14, ext: 25, expectedReq: 26, expectedPass: false },
  { int: 20, ext: 24, expectedReq: 25, expectedPass: false },
  { int: -2, ext: 40, expectedReq: 40, expectedPass: true, note: 'negative internal normalized to 0' },
  { int: 25, ext: 25, expectedReq: 25, expectedPass: true },
  { int: 0, ext: 39, expectedReq: 40, expectedPass: false },
  { int: 0, ext: 40, expectedReq: 40, expectedPass: true },
  { int: 15, ext: 24, expectedReq: 25, expectedPass: false }
];

let failures = 0;
for (const tc of cases) {
  const req = requiredExternalMarks(tc.int);
  const pass = isSubjectPassed(tc.int, tc.ext, tc.int + tc.ext, 100);
  const reqOk = req === tc.expectedReq;
  const passOk = pass === tc.expectedPass;
  if (!reqOk || !passOk) {
    failures += 1;
    console.error('FAIL:', tc, '=>', { req, pass });
  } else {
    console.log('OK  :', tc, '=>', { req, pass });
  }
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}

console.log('\nAll grading tests passed.');
