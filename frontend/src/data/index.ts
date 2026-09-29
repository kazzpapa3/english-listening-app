import type { Item, Mode } from "../types";
import dailyRaw from "./daily.json";
import conferenceRaw from "./conference.json";

const daily = (dailyRaw as Item[]).slice().sort((a, b) => a.order - b.order);
const conference = (conferenceRaw as Item[])
  .slice()
  .sort((a, b) => a.order - b.order);

const store: Record<Mode, Item[]> = {
  daily,
  conference,
};

/**
 * モードの問題一覧を取得する。
 * 将来 DB/API 化する場合はこの関数を差し替えるだけでよい（呼び出し側は非同期前提にできる）。
 */
export function getItems(mode: Mode): Item[] {
  return store[mode];
}
