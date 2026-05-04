import React from "react";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export const NodeSelector: React.FC<{
	value: Id<"nodes"> | undefined;
	onChange: (value: Id<"nodes">) => void;
}> = ({ value, onChange }) => {
	const user = useQuery(api.users.queries.current);
	const nodes = useQuery(
		api.nodes.queries.getAllNodesForUser,
		user ? { userId: user._id } : "skip"
	);

	if (!nodes) return <div />;

	const selectedNode = nodes.find(n => n._id === value);

	return (
		<Select
			value={value ?? ""}
			onValueChange={(v) => {
				if (!v) return;
				onChange(v as Id<"nodes">);
			}}
		>
			<SelectTrigger className="w-[180px]">
				<SelectValue placeholder="Select a Node to Deploy">
					{selectedNode ? selectedNode.name : "Select a Node to Deploy"}
				</SelectValue>
			</SelectTrigger>

			<SelectContent>
				<SelectGroup>
					{nodes.map((n) => (
						<SelectItem key={n._id} value={n._id}>
							{n.name}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
};
