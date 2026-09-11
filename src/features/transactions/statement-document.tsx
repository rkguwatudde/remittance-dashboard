"use client";

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { AdminRemittanceTransactionRow } from "@/lib/remittance-admin-api";

import {
  STATEMENT_DISCLAIMER,
  STATEMENT_TAGLINE,
  buildStatementSummary,
  ellipsize,
  formatCurrencyTotals,
  formatExchangeRate,
  formatFeeAmount,
  formatLedgerAmount,
  formatRemittanceAmount,
  formatSendTotal,
  formatStatementDate,
  statementStatus,
  transactionDescription,
  transactionId,
  transferTypeLabel,
  type StatementStatusKind,
} from "./statement-format";

const colors = {
  primary: "#1F6B4A",
  ink: "#1C2B24",
  muted: "#5C6B64",
  line: "#D4E0D8",
  paper: "#FFFFFF",
  paperAlt: "#F4F8F5",
  completed: "#2E7D57",
  pending: "#9A7B12",
  failed: "#B42318",
  cancelled: "#5C6B64",
  reversed: "#7A4E12",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 100,
    paddingBottom: 52,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  fixedChrome: {
    position: "absolute",
    top: 24,
    left: 36,
    right: 36,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primary,
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
  },
  mark: {
    width: 26,
    height: 26,
    marginRight: 10,
  },
  brandName: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    letterSpacing: 0.4,
  },
  tagline: {
    marginTop: 1,
    fontSize: 8,
    color: colors.muted,
  },
  docLabel: {
    fontSize: 8,
    color: colors.muted,
    textAlign: "right",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 4,
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: colors.ink,
  },
  period: {
    marginTop: 3,
    marginBottom: 10,
    fontSize: 10,
    color: colors.muted,
  },
  sectionTitle: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  continuedTitle: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: colors.line,
  },
  infoCell: {
    width: "50%",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  infoLabel: {
    fontSize: 7,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  metric: {
    width: "19%",
    marginRight: "1%",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors.paperAlt,
  },
  metricLabel: {
    fontSize: 6.5,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: colors.paper,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.6,
    borderBottomColor: colors.line,
    alignItems: "center",
    minHeight: 16,
  },
  tableRowAlt: {
    backgroundColor: colors.paperAlt,
  },
  cell: {
    fontSize: 7.5,
    color: colors.ink,
  },
  cellMuted: {
    fontSize: 7.5,
    color: colors.muted,
  },
  colDate: { width: "12%" },
  colId: { width: "13%" },
  colType: { width: "9%" },
  colDesc: { width: "17%" },
  colStatus: { width: "9%" },
  colRate: { width: "10%", textAlign: "right" },
  colAmt: { width: "11%", textAlign: "right" },
  colFee: { width: "8%", textAlign: "right" },
  colTotal: { width: "11%", textAlign: "right" },
  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 18,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  footerBrand: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  footerTag: {
    fontSize: 7,
    color: colors.muted,
    marginTop: 1,
  },
  footerLegal: {
    fontSize: 6.5,
    color: colors.muted,
    maxWidth: 280,
    textAlign: "right",
  },
  pageNum: {
    fontSize: 7,
    color: colors.muted,
    marginTop: 3,
    textAlign: "right",
  },
});

function statusColor(kind: StatementStatusKind): string {
  if (kind === "completed") return colors.completed;
  if (kind === "pending") return colors.pending;
  if (kind === "failed") return colors.failed;
  if (kind === "cancelled") return colors.cancelled;
  if (kind === "reversed") return colors.reversed;
  return colors.muted;
}

export type StatementCustomer = {
  name: string;
  email: string;
  customerId: string;
};

export type StatementDocumentProps = {
  customer: StatementCustomer;
  periodLabel: string;
  generatedAt: string;
  rows: AdminRemittanceTransactionRow[];
  logoSrc?: string | null;
};

function TableHeader() {
  return (
    <View style={styles.tableHeader} wrap={false}>
      <Text style={[styles.tableHeaderText, styles.colDate]}>Date</Text>
      <Text style={[styles.tableHeaderText, styles.colId]}>Transaction ID</Text>
      <Text style={[styles.tableHeaderText, styles.colType]}>Type</Text>
      <Text style={[styles.tableHeaderText, styles.colDesc]}>Description</Text>
      <Text style={[styles.tableHeaderText, styles.colStatus]}>Status</Text>
      <Text style={[styles.tableHeaderText, styles.colRate]}>FX Rate</Text>
      <Text style={[styles.tableHeaderText, styles.colAmt]}>Amount</Text>
      <Text style={[styles.tableHeaderText, styles.colFee]}>Fee</Text>
      <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
    </View>
  );
}

function BrandHeader({ logoSrc }: { logoSrc?: string | null }) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.brandLockup}>
        {logoSrc ? <Image src={logoSrc} style={styles.mark} /> : null}
        <View>
          <Text style={styles.brandName}>BORABOND</Text>
          <Text style={styles.tagline}>{STATEMENT_TAGLINE}</Text>
        </View>
      </View>
      <Text style={styles.docLabel}>Confidential · Customer statement</Text>
    </View>
  );
}

export function StatementDocument({
  customer,
  periodLabel,
  generatedAt,
  rows,
  logoSrc,
}: StatementDocumentProps) {
  const summary = buildStatementSummary(rows);
  const metrics: { label: string; value: string }[] = [
    { label: "Total transactions", value: String(summary.totalTransactions) },
  ];
  if (summary.sent.length) {
    metrics.push({ label: "Total sent", value: formatCurrencyTotals(summary.sent) });
  }
  if (summary.received.length) {
    metrics.push({ label: "Total received", value: formatCurrencyTotals(summary.received) });
  }
  if (summary.fees.length) {
    metrics.push({ label: "Total fees", value: formatCurrencyTotals(summary.fees) });
  }
  if (summary.investedUsd != null) {
    metrics.push({ label: "Total invested", value: formatLedgerAmount(summary.investedUsd, "USD") });
  }

  return (
    <Document
      title={`BoraBond Monthly Transaction Statement — ${customer.name}`}
      author="BoraBond"
      subject={`Monthly transaction statement for ${periodLabel}`}
      creator="BoraBond Operations"
    >
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <View style={styles.fixedChrome} fixed>
          <BrandHeader logoSrc={logoSrc} />
          <View
            render={({ pageNumber }) =>
              pageNumber > 1 ? (
                <View style={{ marginTop: 8 }}>
                  <TableHeader />
                </View>
              ) : (
                <View />
              )
            }
          />
        </View>

        <Text style={styles.title}>Monthly Transaction Statement</Text>
        <Text style={styles.period}>Statement Period: {periodLabel}</Text>

        <Text style={styles.sectionTitle}>Customer information</Text>
        <View style={styles.infoGrid} wrap={false}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Customer name</Text>
            <Text style={styles.infoValue}>{customer.name || "—"}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{customer.email || "—"}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Customer ID</Text>
            <Text style={styles.infoValue}>{customer.customerId || "—"}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Statement generated</Text>
            <Text style={styles.infoValue}>{generatedAt}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Transaction summary</Text>
        <View style={styles.metrics} wrap={false}>
          {metrics.map((m) => (
            <View key={m.label} style={styles.metric}>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text style={styles.metricValue}>{m.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Transaction details</Text>
        <TableHeader />

        {rows.map((row, index) => {
          const st = statementStatus(row.status);
          return (
            <View
              key={row.id}
              style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
              wrap={false}
              minPresenceAhead={18}
            >
              <Text style={[styles.cellMuted, styles.colDate]}>{formatStatementDate(row.created_at)}</Text>
              <Text style={[styles.cell, styles.colId]}>{ellipsize(transactionId(row), 18)}</Text>
              <Text style={[styles.cell, styles.colType]}>{transferTypeLabel(row.transfer_type)}</Text>
              <Text style={[styles.cell, styles.colDesc]}>{ellipsize(transactionDescription(row), 36)}</Text>
              <Text style={[styles.colStatus, { fontSize: 7.5, color: statusColor(st.kind) }]}>{st.label}</Text>
              <Text style={[styles.cell, styles.colRate]}>{formatExchangeRate(row)}</Text>
              <Text style={[styles.cell, styles.colAmt]}>{formatRemittanceAmount(row)}</Text>
              <Text style={[styles.cellMuted, styles.colFee]}>{formatFeeAmount(row)}</Text>
              <Text style={[styles.cell, styles.colTotal]}>{formatSendTotal(row)}</Text>
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          <View>
            <Text style={styles.footerBrand}>BoraBond</Text>
            <Text style={styles.footerTag}>{STATEMENT_TAGLINE}</Text>
          </View>
          <View>
            <Text style={styles.footerLegal}>{STATEMENT_DISCLAIMER}</Text>
            <Text
              style={styles.pageNum}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
