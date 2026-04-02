import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Support
        </h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-[15px]">
          Runbooks and escalation paths for ops. Replace with your internal wiki
          or PagerDuty links.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Escalation matrix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">L1 — On-call ops:</span>{" "}
            Slack #borabond-ops · PagerDuty service BB-OPS.
          </p>
          <p>
            <span className="font-medium text-foreground">Partner incidents:</span>{" "}
            Open Sev-2 ticket with MTO code + BB trace IDs.
          </p>
          <Button variant="secondary" size="sm">
            Open runbook template
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
