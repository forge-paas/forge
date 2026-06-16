"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Panel, PanelBody, PanelFooter } from "@/components/blueprint/panel";
import { Button } from "@/components/ui/button";
import { CircleNotchIcon, PlayIcon, TrashIcon, TerminalWindowIcon } from "@phosphor-icons/react";

interface Command {
	name: string;
	service?: string;
	command: string;
}

const STATUS_CLASS: Record<string, string> = {
	queued: "text-amber-400",
	running: "text-sky-400",
	done: "text-[var(--status-completed,#3da471)]",
	failed: "text-[var(--status-failed,#e06b6b)]",
};

export function PostInstallPanel({
	deploymentId,
	commands,
	canRun,
}: {
	deploymentId: Id<"deployments">;
	commands: Command[];
	canRun: boolean;
}) {
	const runs = useQuery(api.postinstall.queries.getRunsForDeployment, { deploymentId });
	const runPostInstall = useMutation(api.postinstall.mutations.runPostInstall);
	const clearRun = useMutation(api.postinstall.mutations.clearPostInstallRun);
	const [pending, setPending] = React.useState<string | null>(null);

	if (commands.length === 0) return null;

	const handleRun = async (name: string) => {
		setPending(name);
		try {
			await runPostInstall({ deploymentId, name });
			toast.success("postinstall queued", { description: name });
		} catch (err) {
			toast.error("failed to run", {
				description: err instanceof Error ? err.message : String(err),
			});
		} finally {
			setPending(null);
		}
	};

	const handleClear = async (id: Id<"postInstallRuns">) => {
		try {
			await clearRun({ id });
		} catch (err) {
			toast.error("failed to clear", {
				description: err instanceof Error ? err.message : String(err),
			});
		}
	};

	return (
		<Panel tag="PI" label="Postinstall" caption="run on demand · output is transient">
			<PanelBody className="space-y-4">
				{!canRun && (
					<div className="border border-dashed border-border bg-card/40 px-3 py-2 text-[11px] text-muted-foreground">
						Commands can run only while the deployment is live.
					</div>
				)}
				<div className="flex flex-col divide-y divide-border/60">
					{commands.map((c) => (
						<div key={c.name} className="flex items-center justify-between gap-3 py-2.5">
							<div className="flex min-w-0 flex-col">
								<span className="text-xs font-medium text-foreground">{c.name}</span>
								<span className="truncate font-mono text-[10px] text-muted-foreground">
									{c.service ? `${c.service} · ` : ""}{c.command}
								</span>
							</div>
							<Button
								size="sm"
								variant="outline"
								disabled={!canRun || pending === c.name}
								onClick={() => handleRun(c.name)}
								className="gap-1.5"
							>
								{pending === c.name ? (
									<CircleNotchIcon className="size-3.5 animate-spin" />
								) : (
									<PlayIcon className="size-3.5" />
								)}
								run
							</Button>
						</div>
					))}
				</div>

				{runs && runs.length > 0 && (
					<div className="space-y-3 border-t border-border pt-3">
						<div className="flex items-center gap-2 text-muted-foreground">
							<TerminalWindowIcon className="size-3.5" />
							<span className="bp-label">output · auto-clears after 10 min</span>
						</div>
						{runs.map((r) => (
							<div key={r._id} className="border border-border bg-card/40">
								<div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2">
									<div className="flex items-center gap-2 text-[11px]">
										<span className={`tracking-[0.1em] uppercase ${STATUS_CLASS[r.status] ?? "text-muted-foreground"}`}>
											{r.status === "running" && <CircleNotchIcon className="mr-1 inline size-3 animate-spin" />}
											{r.status}
										</span>
										<span className="font-medium text-foreground">{r.name}</span>
										{typeof r.exitCode === "number" && (
											<span className="tabular-nums text-muted-foreground">exit {r.exitCode}</span>
										)}
									</div>
									<Button
										variant="ghost"
										size="icon-sm"
										onClick={() => handleClear(r._id)}
										aria-label="clear output"
									>
										<TrashIcon className="size-3.5" />
									</Button>
								</div>
								{r.output ? (
									<pre className="max-h-72 overflow-auto px-3 py-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all text-foreground/90">
										{r.output}
									</pre>
								) : (
									<div className="px-3 py-2.5 text-[11px] text-muted-foreground">
										{r.status === "queued" || r.status === "running" ? "waiting for output…" : "no output"}
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</PanelBody>
			<PanelFooter>
				<span>section PI · postinstall</span>
				<span className="tabular-nums">{commands.length} command{commands.length === 1 ? "" : "s"}</span>
			</PanelFooter>
		</Panel>
	);
}
