/**
 * 图标辅助
 *
 * uTools 的 feature.icon 只接受图片路径或 Base64 Data URL，Emoji 无法直接使用，
 * 因此只有当图标是 Data URL 时才传给 uTools。
 */

export function isImageIcon(icon) {
  return typeof icon === 'string' && icon.startsWith('data:')
}

/** 取可以交给 uTools 的图标值，不是图片时返回 undefined */
export function featureIcon(command) {
  const icon = command && command.icon
  return isImageIcon(icon) ? icon : undefined
}
