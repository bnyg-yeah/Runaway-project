/**
 * A global provider so any client component can use useQuery
 * A QueryClient is the brain that stores all fetched data cache, status for each requests, and settings like retry rules
 * new QueryClient() creates the data manager with rules, then QueryClientProvider wraps the app so that any component can call useQuery or use Mutation
 * Inside a component, you call useQuery which asks the QueryClient if we already cached this data, this avoids multiple unnecessary API calls
 * With QueryClient, you featch each API once, data is shared automatically across components, you can control freshness per API
 * */
"use client";

import React, { PropsWithChildren, useState } from "react"; //for building components and managing state

import {QueryClient, QueryClientProvider} from "@tanstack/react-query"; //Tanstack Query provides caching, deduping, retries for client side data fetching

/**
 * Providers creates a single QueryClient instance and exposes it to the entire app.
 * @param param0 
 */
export default function Providers( {children}: PropsWithChildren) {

    const [queryCLient] = useState (
        () => 
            new QueryClient ({
                defaultOptions: {
                    queries: {
                        //avoid refetching on every window focus 
                        refetchOnWindowFocus: false, 
                    },
                },
            })
            
    );
//Queryclientprovuder makes react query available to descendats
    return <QueryClientProvider client={queryCLient}> {children} </QueryClientProvider>;
}