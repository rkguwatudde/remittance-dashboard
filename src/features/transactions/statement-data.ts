import {
  adminRemittanceTransactions,
  type AdminRemittanceTransactionRow,
} from "@/lib/remittance-admin-api";

import { monthRangeIso } from "./statement-format";

const PAGE_SIZE = 100;
const EXPORT_CAP = 5000;

export async function fetchMonthlyStatementTransactions(
  accessToken: string,
  input: { userId: string; year: number; monthIndex: number },
): Promise<{ rows: AdminRemittanceTransactionRow[]; totalMatched: number }> {
  const { dateFrom, dateTo } = monthRangeIso(input.year, input.monthIndex);
  const collected: AdminRemittanceTransactionRow[] = [];
  let offset = 0;
  let apiTotal = 0;

  while (collected.length < EXPORT_CAP) {
    const res = await adminRemittanceTransactions(accessToken, {
      limit: PAGE_SIZE,
      offset,
      sort: "created_at_asc",
      date_from: dateFrom,
      date_to: dateTo,
      q: input.userId,
      recipient_entity_type: "individual",
    });
    apiTotal = res.pagination.total;
    const mine = res.transactions.filter((row) => row.user_id === input.userId);
    collected.push(...mine);
    if (res.transactions.length < PAGE_SIZE || offset + res.transactions.length >= res.pagination.total) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return { rows: collected, totalMatched: apiTotal };
}

export async function previewMonthlyStatementCount(
  accessToken: string,
  input: { userId: string; year: number; monthIndex: number },
): Promise<number> {
  const { dateFrom, dateTo } = monthRangeIso(input.year, input.monthIndex);
  const res = await adminRemittanceTransactions(accessToken, {
    limit: 1,
    offset: 0,
    sort: "created_at_asc",
    date_from: dateFrom,
    date_to: dateTo,
    q: input.userId,
    recipient_entity_type: "individual",
  });
  return res.pagination.total;
}
