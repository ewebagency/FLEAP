import React from "react";

interface User {
    id:number;
    name:string;
    email:string;
}

const UsersPage = async () => {
    //https://jsonplaceholder.typicode.com/users
    const res = await fetch('http://localhost:3000/api/user', {cache:"no-store"});
    const users:User[] = await res.json();
    return (
        <>
        <p>{new Date().toLocaleTimeString()}</p>
        <table className="table-sm m-5">
            <thead>
                <th>
                    <tr>Name</tr>
                    <tr>Mail</tr>
                </th>
            </thead>
            <tbody>
            {users.map(user => <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
            </tr>)}
            </tbody>
        </table>
        </>
    )
}

export default UsersPage