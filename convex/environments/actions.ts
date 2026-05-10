import { v } from "convex/values";
import { action, httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { decryptEnvVariable } from "./nodejs/actions";
import { Id } from "../_generated/dataModel";

export const createProjectSecrets = action({
	args: {
		envId: v.id("environments"),
		envString: v.string(),
	},
	handler: async (ctx, args) => {
		const secrets = args.envString
			.split("\n")
			.filter(Boolean)
			.map((env) => {
				const [key, ...rest] = env.split("=");
				let value = rest.join("=");

				if (value.startsWith('"')) value = value.slice(1);
				if (value.endsWith('"')) value = value.slice(0, -1);

				return { key, value };
			});

		const encryptedEnvRes = await Promise.all(
			secrets.map(({ key, value }) =>
				ctx.runAction(
					internal.environments.nodejs.actions.encryptEnvVariable,
					{ key, value }
				)
			)
		);

		await Promise.all(
			encryptedEnvRes.map((secret) =>
				ctx.runMutation(
					internal.secrets.mutations.insertSecret,
					{
						...secret,
						environmentId: args.envId,
					}
				)
			)
		);
	},
});

// TODO: Fix object level authorization
export const getEnvironmentSecretsAction = httpAction(async (ctx, req) => {
	const authHeader = req.headers.get("Authorization")
	const nodeToken = authHeader?.split(" ")[1] ?? "";

	if (!nodeToken) {
		throw new Error("Unauthorized - No node token");
	}

	const tokenHash = await ctx.runAction(internal.nodes.nodejs.actions.hashToken, { token: nodeToken });

	const node = await ctx.runQuery(internal.nodes.queries.getNodeByNodeToken, { tokenHash: tokenHash });

	if (!node) {
		throw new Error("Invalid node");
	}

	const body = await req.json();
	const { projectId } = body;

	const envId = await ctx.runQuery(internal.environments.queries.getEnvByProjectId, {
		projectId: projectId as Id<"projects">,
	});

	if (!envId) {
		throw new Error("No environment id found")
	}

	const secrets = await ctx.runQuery(internal.secrets.queries.getEnvSecrets, {
		envId: envId
	});

	const decryptedEnvRes = await Promise.all(
		secrets.map(s =>
			ctx.runAction(
				internal.environments.nodejs.actions.decryptEnvVariable,
				{
					wrapIv: s.wrapIv, wrapTag: s.wrapTag, wrappedKey: s.wrappedKey,
					dataIv: s.dataIv, dataTag: s.dataTag, ciphertext: s.ciphertext,
					key: s.key
				}
			)
		)
	);

	return new Response(JSON.stringify(decryptedEnvRes), { status: 200 });
})
