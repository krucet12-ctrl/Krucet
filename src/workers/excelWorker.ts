import * as xlsx from "xlsx";

type DetectedRange = {
  id: string;
  batch: string;
  branch: string;
  type: "Regular" | "Lateral";
  startRoll: string;
  endRoll: string;
};

type WorkerIn =
  | { type: "parse"; file: File };

type WorkerOut =
  | { type: "progress"; stage: "reading" | "parsing" | "scanning"; current: number; total: number }
  | { type: "result"; detectedRanges: DetectedRange[]; parsedDataMap: Record<string, any> }
  | { type: "error"; message: string };

const post = (msg: WorkerOut) => {
  (self as any).postMessage(msg);
};

const yieldToWorker = () => new Promise<void>((r) => setTimeout(r, 0));

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  try {
    if (!e.data || e.data.type !== "parse") return;
    const file = e.data.file;

    post({ type: "progress", stage: "reading", current: 0, total: 1 });
    const data = await file.arrayBuffer();
    post({ type: "progress", stage: "reading", current: 1, total: 1 });

    post({ type: "progress", stage: "parsing", current: 0, total: 1 });
    const workbook = xlsx.read(data, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json<any>(firstSheet);
    post({ type: "progress", stage: "parsing", current: 1, total: 1 });

    const students: Array<{ rollNo: string; batch: string; branch: string }> = [];
    const seenRolls = new Set<string>();
    const extractedMap: Record<string, any> = {};

    post({ type: "progress", stage: "scanning", current: 0, total: jsonData.length || 1 });

    const CHUNK = 100;
    for (let i = 0; i < jsonData.length; i += CHUNK) {
      const slice = jsonData.slice(i, i + CHUNK);

      for (const row of slice) {
        if (typeof row !== "object" || row === null) continue;

        for (const key of Object.keys(row)) {
          const cell = row[key];
          if (cell === undefined || cell === null) continue;

          const strVal = String(cell).trim().toUpperCase();
          const extractMatch = strVal.match(/([YL]\d{2}[A-Z]{2,6}\d{3,})/);
          if (!extractMatch) continue;

          const rollNo = extractMatch[1];
          const parseReq = rollNo.match(/^([YL]\d{2})([A-Z]{2,6})(\d+)$/);
          if (!parseReq) break;

          const batch = parseReq[1];
          let branch = parseReq[2];
          if (branch === "AIM") branch = "AIML";

          if (!seenRolls.has(rollNo)) {
            seenRolls.add(rollNo);
            students.push({ rollNo, batch, branch });
            extractedMap[rollNo] = row;
          }
          break;
        }
      }

      post({ type: "progress", stage: "scanning", current: Math.min(i + CHUNK, jsonData.length), total: jsonData.length || 1 });
      await yieldToWorker();
    }

    if (students.length === 0) {
      throw new Error(
        "No valid roll numbers found. Make sure roll numbers match structures like Y22CSE101 or L23ECE123."
      );
    }

    const groups: { [key: string]: DetectedRange } = {};
    for (const student of students) {
      const type: "Regular" | "Lateral" = student.batch.startsWith("L") || student.rollNo.startsWith("L") ? "Lateral" : "Regular";
      const key = `${student.batch}_${student.branch}_${type}`;
      if (!groups[key]) {
        groups[key] = { id: key, startRoll: student.rollNo, endRoll: student.rollNo, batch: student.batch, branch: student.branch, type };
      } else {
        if (student.rollNo < groups[key].startRoll) groups[key].startRoll = student.rollNo;
        if (student.rollNo > groups[key].endRoll) groups[key].endRoll = student.rollNo;
      }
    }

    post({ type: "result", detectedRanges: Object.values(groups), parsedDataMap: extractedMap });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};

