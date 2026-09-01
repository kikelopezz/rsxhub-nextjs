import type { Circuit } from '@/types'

export const DEFAULT_CIRCUITS: Circuit[] = [
  { id: 'sys-daytona', name: 'Daytona International Speedway', slug: 'daytona-international-speedway', imageUrl: '', isSystem: true },
  { id: 'sys-monza', name: 'Autodromo Nazionale Monza', slug: 'autodromo-nazionale-monza', imageUrl: '', isSystem: true },
  { id: 'sys-spa', name: 'Circuit de Spa-Francorchamps', slug: 'circuit-de-spa-francorchamps', imageUrl: '', isSystem: true },
  { id: 'sys-imola', name: 'Autodromo Enzo e Dino Ferrari', slug: 'autodromo-enzo-e-dino-ferrari', imageUrl: '', isSystem: true },
  { id: 'sys-lemans', name: 'Circuit de la Sarthe', slug: 'circuit-de-la-sarthe', imageUrl: '', isSystem: true },
  { id: 'sys-nurburgring', name: 'Nurburgring GP', slug: 'nurburgring-gp', imageUrl: '', isSystem: true },
]
