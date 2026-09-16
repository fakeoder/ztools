import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-700.css'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/bebas-neue/latin-400.css'
import '@fontsource/merriweather/latin-400.css'
import '@fontsource/merriweather/latin-700.css'
import '@fontsource/playfair-display/latin-400.css'
import '@fontsource/playfair-display/latin-700.css'
import '@fontsource/pacifico/latin-400.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-700.css'

import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url'
import inter700 from '@fontsource/inter/files/inter-latin-700-normal.woff2?url'
import roboto400 from '@fontsource/roboto/files/roboto-latin-400-normal.woff2?url'
import roboto700 from '@fontsource/roboto/files/roboto-latin-700-normal.woff2?url'
import poppins400 from '@fontsource/poppins/files/poppins-latin-400-normal.woff2?url'
import poppins700 from '@fontsource/poppins/files/poppins-latin-700-normal.woff2?url'
import nunito400 from '@fontsource/nunito/files/nunito-latin-400-normal.woff2?url'
import nunito700 from '@fontsource/nunito/files/nunito-latin-700-normal.woff2?url'
import bebas400 from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2?url'
import merriweather400 from '@fontsource/merriweather/files/merriweather-latin-400-normal.woff2?url'
import merriweather700 from '@fontsource/merriweather/files/merriweather-latin-700-normal.woff2?url'
import playfair400 from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url'
import playfair700 from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url'
import pacifico400 from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff2?url'
import jetbrains400 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url'
import jetbrains700 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2?url'

export type FontWeight = 400 | 700
export type FontCategory = 'sans' | 'serif' | 'display' | 'script' | 'mono'

export interface FontDef {
  id: string
  family: string
  label: string
  category: FontCategory
  weights: Partial<Record<FontWeight, string>>
}

export const FONTS: FontDef[] = [
  { id: 'inter', family: 'Inter', label: 'Inter', category: 'sans', weights: { 400: inter400, 700: inter700 } },
  { id: 'roboto', family: 'Roboto', label: 'Roboto', category: 'sans', weights: { 400: roboto400, 700: roboto700 } },
  { id: 'poppins', family: 'Poppins', label: 'Poppins', category: 'sans', weights: { 400: poppins400, 700: poppins700 } },
  { id: 'nunito', family: 'Nunito', label: 'Nunito', category: 'sans', weights: { 400: nunito400, 700: nunito700 } },
  { id: 'bebas', family: 'Bebas Neue', label: 'Bebas Neue', category: 'display', weights: { 400: bebas400 } },
  { id: 'merriweather', family: 'Merriweather', label: 'Merriweather', category: 'serif', weights: { 400: merriweather400, 700: merriweather700 } },
  { id: 'playfair', family: 'Playfair Display', label: 'Playfair Display', category: 'serif', weights: { 400: playfair400, 700: playfair700 } },
  { id: 'pacifico', family: 'Pacifico', label: 'Pacifico', category: 'script', weights: { 400: pacifico400 } },
  { id: 'jetbrains', family: 'JetBrains Mono', label: 'JetBrains Mono', category: 'mono', weights: { 400: jetbrains400, 700: jetbrains700 } },
]

export function getFont(id: string): FontDef {
  return FONTS.find((f) => f.id === id) ?? FONTS[0]
}

export function availableWeight(font: FontDef, weight: FontWeight): FontWeight {
  return font.weights[weight] ? weight : 400
}
