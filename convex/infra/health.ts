import { v } from "convex/values";
import { internal } from "../_generated/api";
import { httpAction, internalQuery } from "../_generated/server";

export const getInfraHealthTargets = internalQuery({
	args: { id: v.id("nodes") },
	handler: async (ctx, args) => {
		const rows = await ctx.db.query("deployments")
			.withIndex("by_nodeId", n => n.eq("nodeId", args.id))
			.collect();

		const completed = rows.filter(d => d.type === "infra" && d.status === "completed" && !!d.infraId);

		const targets = await Promise.all(completed.map(async (dep) => {
			const container = dep.infraId ? await ctx.db.get(dep.infraId) : null;
			if (!container || !container.healthCheck) return null;
			return {
				deploymentId: dep._id,
				healthToken: dep.healthToken ?? "",
				containerName: container.containerName,
				service: container.healthCheck.service,
				command: container.healthCheck.command,
			};
		}));

		return targets.filter((t): t is NonNullable<typeof t> => t !== null && t.healthToken !== "");
	}
});

export const getInfraHealthChecksAction = httpAction(async (ctx, req) => {
	const authHeader = req.headers.get("Authorization");
	const nodeToken = authHeader?.split(" ")[1] ?? "";
	if (!nodeToken) throw new Error("Unauthorized - No node token");

	const tokenHash = await ctx.runAction(internal.nodes.nodejs.actions.hashToken, { token: nodeToken });
	const node = await ctx.runQuery(internal.nodes.queries.getNodeByNodeToken, { tokenHash });

	if (!node) {
		console.warn("infra-health poll from unknown/stale node token");
		return new Response(JSON.stringify([]), { status: 200 });
	}

	const targets = await ctx.runQuery(internal.infra.health.getInfraHealthTargets, { id: node._id });
	return new Response(JSON.stringify(targets), { status: 200 });
});
