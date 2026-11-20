import type { TemplateId } from "./schema";

/**
 * Who may choose a private template.
 *
 * The God Poetry layout was made for one birthday, and it is offered only to
 * the account it belongs to. This is an **authoring** gate, not a rendering
 * one: a published site using the template stays public, because the person
 * opening the gift is not expected to have an account. What is hidden from
 * everyone else is the option to use it.
 *
 * The list is by email rather than uid because an email is something the owner
 * can recognise in the dashboard and in this file. Firebase returns it on the
 * session, and `useSession` already exposes it. Local development has no
 * account at all, which is why the callers treat `method: "local"` as allowed
 * — production fails closed before it ever reaches this helper.
 */
const PRIVATE_TEMPLATE_OWNERS: Partial<Record<TemplateId, readonly string[]>> = {
  godpoetry: ["youcantseemieirl@gmail.com"],
};

/**
 * Whether an account may pick this template.
 *
 * Public templates answer `true` for everyone, including a signed-out visitor:
 * the question is about the picker, not about reading a published page.
 * Private templates fail closed on a missing or non-matching email.
 */
export function isTemplateAvailable(
  template: string,
  email: string | null | undefined,
): boolean {
  const owners = PRIVATE_TEMPLATE_OWNERS[template as TemplateId];
  if (!owners) return true;

  const address = email?.trim().toLowerCase();
  if (!address) return false;

  return owners.some((owner) => owner.toLowerCase() === address);
}

/** True when the template is restricted to named accounts. */
export function isPrivateTemplate(template: string): boolean {
  return template in PRIVATE_TEMPLATE_OWNERS;
}
