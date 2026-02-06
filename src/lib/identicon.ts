/**
 * Generate a unique identicon (geometric avatar) based on a string (user ID or email)
 */
export function generateIdenticon(input: string, size: number = 80): string {
  // Simple hash function
  const hash = (str: string): number => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  const hashValue = hash(input)

  // Generate color from hash
  const hue = hashValue % 360
  const saturation = 65 + (hashValue % 20)
  const lightness = 50 + (hashValue % 15)

  const backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`
  const foregroundColor = `hsl(${hue}, ${saturation}%, ${lightness - 20}%)`

  // Generate a simple geometric pattern
  const pattern = (hashValue % 16).toString(2).padStart(4, '0')

  // Create SVG
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${backgroundColor}"/>
      ${pattern
      .split('')
      .map((bit, index) => {
        if (bit === '1') {
          const x = (index % 2) * (size / 2)
          const y = Math.floor(index / 2) * (size / 2)
          return `<rect x="${x}" y="${y}" width="${size / 2}" height="${size / 2}" fill="${foregroundColor}"/>`
        }
        return ''
      })
      .join('')}
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 4}" fill="${foregroundColor}" opacity="0.3"/>
    </svg>
  `

  // Convert to data URL
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

/**
 * Get initials from a name
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return 'U'
  const parts = name.trim().split(' ')
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Generate a simple avatar with initials
 */
export function generateInitialsAvatar(name: string, size: number = 80): string {
  const initials = getInitials(name)
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const hue = hash % 360

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="hsl(${hue}, 65%, 50%)"/>
      <text
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="${size / 2.5}"
        font-weight="bold"
        fill="white"
      >${initials}</text>
    </svg>
  `

  return `data:image/svg+xml;base64,${btoa(svg)}`
}
