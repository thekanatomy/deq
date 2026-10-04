import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { useState } from "react"


export default function App() {
  const people = useLiveQuery(() => db.cards.toArray())
const [name, setName] =  useState("")

async function addPerson() {
  await db.cards.add({ name: name, place: "Tempe", lastContacted: Date.now() })
  setName("")
}

  return (
    <div className=  "page">
      <input  value = {name} onChange = {e => setName (e.target.value)} />
      <button onClick = {addPerson}>Add</button>

      {people?.map(person =>(
      <div className =  "card" key = {person.name}>
        <h2> {person.name}</h2>

        <p>{person.place} . {person.days} days ago</p>
      </div>
      ))}
    </div>
  )
}