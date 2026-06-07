import { v } from "convex/values";
import { internalQuery, query } from "../_generated/server";
import { getCurrentUser } from "../users/queries";

export const getRunsForDeployment = query({
	args: { deploymentId: v.id("deployments") },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!user) throw new Error("Unauthorized");

		const dep = await ctx.db.get(args.deploymentId);
		if (!dep) throw new Error("Deployment not found");
		if (!dep.infraId) return [];
		const container = await ctx.db.get(dep.infraId);
		if (!container || container.ownerId !== user._id) throw new Error("Forbidden");

		const runs = await ctx.db.query("postInstallRuns")
			.withIndex("by_deploymentId", q => q.eq("deploymentId", args.deploymentId))
			.collect();

		return runs.sort((a, b) => b._creationTime - a._creationTime);
	}
});

export const getQueuedRuns = internalQuery({
	args: { id: v.id("nodes") },
	handler: async (ctx, args) => {
		const rows = await ctx.db.query("postInstallRuns")
			.withIndex("by_nodeId", n => n.eq("nodeId", args.id))
			.collect();

		const queued = rows.filter(r => r.status === "queued");

		return await Promise.all(queued.map(async (run) => {
			const dep = await ctx.db.get(run.deploymentId);
			const container = dep?.infraId ? await ctx.db.get(dep.infraId) : null;
			return {
				_id: run._id,
				deploymentId: run.deploymentId,
				name: run.name,
				service: run.service,
				command: run.command,
				containerName: container?.containerName ?? "",
			};
		}));
	}
});
