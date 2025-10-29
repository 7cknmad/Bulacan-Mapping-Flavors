export type ToastType = 'success' | 'error' | 'info';

function createContainer() {
  let el = document.getElementById('bmf-toast-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bmf-toast-container';
    Object.assign(el.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '9999',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      alignItems: 'flex-end',
    });
    document.body.appendChild(el);
  }
  return el;
}

export function showToast(message: string, type: ToastType = 'info', duration = 3500) {
  const container = createContainer();
  const node = document.createElement('div');
  node.textContent = message;
  node.style.maxWidth = '320px';
  node.style.padding = '10px 12px';
  node.style.borderRadius = '8px';
  node.style.color = '#fff';
  node.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
  node.style.fontSize = '14px';
  node.style.lineHeight = '1.2';

  switch (type) {
    case 'success':
      node.style.background = '#16a34a'; // green-600
      break;
    case 'error':
      node.style.background = '#dc2626'; // red-600
      break;
    default:
      node.style.background = '#0ea5e9'; // sky-500
  }

  container.appendChild(node);

  setTimeout(() => {
    try { node.style.transition = 'opacity 200ms ease'; node.style.opacity = '0'; } catch {}
  }, duration - 200);

  setTimeout(() => { try { container.removeChild(node); } catch {} }, duration);
}

export default showToast;
