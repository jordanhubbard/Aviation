const menuItems = ['MAP', 'ENGINE', 'NRST', 'FPL', 'PROC', 'MENU']

export const MenuSystem = () => {
  return (
    <div className="mfd__menu">
      {menuItems.map((item, index) => (
        <button
          key={item}
          className={`mfd__menu-key ${index === 0 ? 'mfd__menu-key--active' : ''}`}
          type="button"
        >
          {item}
        </button>
      ))}
    </div>
  )
}
