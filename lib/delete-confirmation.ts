export type ConfirmationDetails =
  | { kind: "hobby"; name: string }
  | { kind: "journal"; date: string }
  | { kind: "sleep"; date: string; hours: number }
  | { kind: "sign-out" };

export function getConfirmationContent(details: ConfirmationDetails) {
  switch (details.kind) {
    case "hobby":
      return {
        message: `This action will delete "${details.name}" and all its check-ins. This cannot be undone.`,
        cancelLabel: "Keep Hobby",
        confirmLabel: "Delete Hobby",
      };
    case "journal":
      return {
        message: `This action will delete your journal entry for ${details.date}. This cannot be undone.`,
        cancelLabel: "Keep Entry",
        confirmLabel: "Delete Entry",
      };
    case "sleep":
      return {
        message: `This action will delete ${details.hours} hours of sleep for ${details.date}. This cannot be undone.`,
        cancelLabel: "Keep Record",
        confirmLabel: "Delete Record",
      };
    case "sign-out":
      return {
        message: "This action will sign you out of your account. You can sign back in at any time.",
        cancelLabel: "Stay Signed In",
        confirmLabel: "Sign Out",
      };
  }
}
