export function modal(title, body = '', buttons = []) {
  const root = document.createElement('div');
  root.className = 'modal-backdrop';
  root.innerHTML = `<div class="modal-panel"><h2>${title}</h2><div class="modal-body">${body}</div><div class="modal-actions"></div></div>`;
  const actions = root.querySelector('.modal-actions');
  buttons.forEach(b => {
    const button = document.createElement('button');
    button.className = b.primary ? 'primary' : '';
    button.textContent = b.label;
    button.onclick = () => { b.action?.(); root.remove(); };
    actions.appendChild(button);
  });
  document.body.appendChild(root);
  return root;
}
