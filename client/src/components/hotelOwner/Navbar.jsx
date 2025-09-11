import React from "react"
import { assets } from "../../assets/assets"
import {Link} from 'react-router-dom'
import {UserButton} from '@clerk/clerk-react'
const Navbar = () => {
  return (
    <div className="flex items-center justify-between px-4 md:px-8border-b border-gray-300 py-3 bg-white transition-all duration-300">
      <Link to="/">
        <img src={assets.logo} alt="logo" className="h-9 opacity-1000"/>
      </Link>
      <UserButton />
    </div>
  )
}

export default Navbar
