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
 * The gate accepts either the owner's email or their stable Firebase uid. The
 * email stays here because it is recognisable; the uid is the reliable key.
 * An email is easy to mistype in either the account or this file, and a typo
 * looks exactly like "the private template is missing" to the person affected.
 *
 * Local development has no account at all, which is why the callers treat
 * `method: "local"` as allowed. Production fails closed before it ever reaches
 * this helper.
 */
type TemplateOwner = {
  emails: readonly string[];
  uids: readonly string[];
};

const PRIVATE_TEMPLATE_OWNERS: Partial<Record<TemplateId, TemplateOwner>> = {
  godpoetry: {
    emails: ["youcantseemeirl@gmail.com"],
    uids: [
      // The account that owns /s/esther-ml and asked for this template.
      "ZQ2aXAydhyN36I8ngH33WAxlZ7u2",
    ],
  },
};

/**
 * Whether an account may pick this template.
 *
 * Public templates answer `true` for everyone, including a signed-out visitor:
 * the question is about the picker, not about reading a published page.
 * Private templates fail closed on a missing or non-matching email/uid.
 */
export function isTemplateAvailable(
  template: string,
  email: string | null | undefined,
  uid?: string | null,
): boolean {
  const owner = PRIVATE_TEMPLATE_OWNERS[template as TemplateId];
  if (!owner) return true;

  if (uid && owner.uids.includes(uid)) return true;

  const address = email?.trim().toLowerCase();
  if (!address) return false;

  return owner.emails.some((allowed) => allowed.toLowerCase() === address);
}

/** True when the template is restricted to named accounts. */
export function isPrivateTemplate(template: string): boolean {
  return template in PRIVATE_TEMPLATE_OWNERS;
}
