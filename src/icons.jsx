// One icon family for the whole app, drawn in the style of Apple's SF Symbols:
// 24-unit grid, 1.9 stroke, round caps and joins, optically centred.
function Icon({ size = 20, children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const PlusIcon = props => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const MenuIcon = props => (
  <Icon {...props}>
    <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />
  </Icon>
)

export const CloseIcon = props => (
  <Icon {...props}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Icon>
)

export const BackIcon = props => (
  <Icon {...props}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Icon>
)

export const MoreIcon = ({ size = 20 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <circle cx="5.5" cy="12" r="1.7" fill="currentColor" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.7" fill="currentColor" />
  </svg>
)

// the square-and-arrow share glyph
export const ShareIcon = props => (
  <Icon {...props}>
    <path d="M12 3.5v11M8 7.5l4-4 4 4" />
    <path d="M8.5 10.5H7a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.5a2 2 0 0 0-2-2h-1.5" />
  </Icon>
)

// four rounded tiles, like SF Symbols' square.grid.2x2: categories
export const CategoriesIcon = props => (
  <Icon {...props}>
    <rect x="4.5" y="4.5" width="6" height="6" rx="1.6" />
    <rect x="13.5" y="4.5" width="6" height="6" rx="1.6" />
    <rect x="4.5" y="13.5" width="6" height="6" rx="1.6" />
    <rect x="13.5" y="13.5" width="6" height="6" rx="1.6" />
  </Icon>
)

export const SearchIcon = props => (
  <Icon {...props}>
    <circle cx="10.75" cy="10.75" r="6.25" />
    <path d="m15.5 15.5 4.25 4.25" />
  </Icon>
)
