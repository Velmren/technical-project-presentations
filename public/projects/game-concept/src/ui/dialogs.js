// Confirmation dialog: a native <dialog>, so focus is trapped and Escape
// cancels without extra code.

export function renderConfirm({title, body, confirm, cancel}) {
  return `
    <form method="dialog">
      <div class="dialog-head"><h2 class="h2" id="confirm-title">${title}</h2></div>
      <div class="dialog-body"><p class="lead">${body}</p></div>
      <div class="dialog-actions">
        <button class="btn btn-secondary" value="cancel">${cancel}</button>
        <button class="btn btn-primary" value="confirm">${confirm}</button>
      </div>
    </form>`;
}
