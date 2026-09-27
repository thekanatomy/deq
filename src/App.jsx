import { useState } from "react"


export default function App() {
  const [people, setPeople] = useState([])
const [name, setName] =  useState("")

function addPerson(){
  setPeople([...people, {name: name, place: "Tempe", days: 0}])
}

  return (
    <div className=  "page">
      <input  value = {name} onChange = {e => setName (e.target.value)} />
      <button onClick = {addPerson}>Add</button>

      {people.map(person =>(
      <div className =  "card" key = {person.name}>
        <h2> {person.name}</h2>

        <p>{person.place} . {person.days} days ago</p>
      </div>
      ))}
    </div>
  )
}