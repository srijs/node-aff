# Motivation

Side-effects are inevitable. What's more, without them, the software we write would be worthless. Many of the useful things that software does begin with a side effect, and end in one, leaving no trace of its execution but those side-effects. Be it on the command line, where we read input from the user and print some output as our program ends, or as a web server, where we start by reading a request, and finish by writing out a response.

While it is commonly accepted that we want to keep the side-effects outside of the core logic of our programs as much as possible, which leads to code that is easier to test and refactor, it still means we can't avoid side-effects. At one point or another, but hopefully as marginally as possible in our program, we need to deal with them.

Consequently, there is not only great merit in avoiding side-effects, but also in being able to exert as much control over them as possible at the inevitable point where we have to face them. In order for us as craftspeople to do that, we need to have the appropriate tools for the job.
