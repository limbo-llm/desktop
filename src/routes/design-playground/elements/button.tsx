import { createListCollection } from "@ark-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../../../components/button";
import { Checkbox } from "../../../components/checkbox";
import { Field, FieldLabel, InlineField } from "../../../components/field";
import { SimpleSelect, SimpleSelectItem } from "../../../components/select";
import {
	ComponentPreview,
	ComponentPreviewContent,
	ComponentPreviewPanel,
} from "../../../features/design-playground/components/component-preview";

export const Route = createFileRoute("/design-playground/elements/button")({
	component: ButtonElementPage,
});

function ButtonElementPage() {
	const [buttonColor, setButtonColor] = useState("primary");
	const [buttonVariant, setButtonVariant] = useState("default");
	const [isDisabled, setIsDisabled] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	const buttonColorCollection = createListCollection({
		items: [
			{ value: "primary", label: "Primary" },
			{ value: "secondary", label: "Secondary" },
		],
	});

	const buttonVariantCollection = createListCollection({
		items: [
			{
				value: "default",
				label: "Default",
			},
			{
				value: "ghost",
				label: "Ghost",
			},
		],
	});

	return (
		<ComponentPreview>
			<ComponentPreviewContent>
				<Button
					disabled={isDisabled}
					isLoading={isLoading}
					color={buttonColor as any}
					variant={buttonVariant as any}
				>
					Click me
				</Button>
			</ComponentPreviewContent>
			<ComponentPreviewPanel>
				<Field
					label="Color"
					control={
						<SimpleSelect
							collection={buttonColorCollection}
							value={[buttonColor]}
							onValueChange={(e) => setButtonColor(e.value[0])}
						>
							{buttonColorCollection.items.map((item) => (
								<SimpleSelectItem item={item} label={item.label} key={item.value} />
							))}
						</SimpleSelect>
					}
				/>
				<Field
					label="Variant"
					control={
						<SimpleSelect
							value={[buttonVariant]}
							collection={buttonVariantCollection}
							onValueChange={(e) => setButtonVariant(e.value[0])}
						>
							{buttonVariantCollection.items.map((item) => (
								<SimpleSelectItem item={item} label={item.label} key={item.value} />
							))}
						</SimpleSelect>
					}
				/>
				<InlineField
					label="Disabled?"
					control={
						<Checkbox
							checked={isDisabled}
							onCheckedChange={(e) => setIsDisabled(e.checked as boolean)}
						/>
					}
				/>
				<InlineField
					label="Loading?"
					control={
						<Checkbox
							checked={isLoading}
							onCheckedChange={(e) => setIsLoading(e.checked as boolean)}
						/>
					}
				/>
			</ComponentPreviewPanel>
		</ComponentPreview>
	);
}
