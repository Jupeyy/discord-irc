import { io, Socket } from 'socket.io-client'
import { ClientToServerEvents, ServerToClientEvents, IrcMessage } from './socket.io'

import DOMPurify from 'dompurify'
// import hljs from 'highlight.js' // works but is slow because it bloats in too many langs
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import rust from 'highlight.js/lib/languages/rust';
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('rust', rust);

import './style.css'
import 'highlight.js/styles/github.css';

const backendUrl = process.env.BACKEND_URL

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(backendUrl)

socket.on('connect', () => {
    console.log(`connected to ${backendUrl}`)
})

const messagesContainer = document.querySelector('.messages')

const xssSanitize = (userinput: string) => {
    userinput = userinput.replaceAll('<', '&lt;')
    userinput = userinput.replaceAll('>', '&gt;')
    return DOMPurify.sanitize(userinput)
}

const enrichText = (userinput: string) => {
    userinput = userinput.replaceAll(
        new RegExp('https?://[a-zA-Z0-9_\\[\\]\\?\\#\\:\\&\\$\\+\\*\\%/\\.]+\\.(png|jpg|jpeg|webp)', 'ig'),
        (m) => `<img class="embed-img" src="${m}">`
    )
    userinput = userinput.replaceAll(
        new RegExp('```(.*)```', 'ig'),
        (m, $1) => `<div class="single-line-code-snippet">${hljs.highlightAuto($1).value}</div>`
    )
    userinput = userinput.replaceAll(
        new RegExp('``(.*)``', 'ig'),
        (m, $1) => `<div class="single-line-code-snippet">${$1}</div>`
    )
    userinput = userinput.replaceAll(
        new RegExp('`(.*)`', 'ig'),
        (m, $1) => `<div class="single-line-code-snippet">${$1}</div>`
    )
    // userinput = userinput.replaceAll(
    //     new RegExp('`(.*)`', 'ig'),
    //     (m, $1) => hljs.highlight($1, {language: 'c'}).value
    // )
    return userinput
}

const renderMessage = (message: IrcMessage, isBridge = false) => {
    messagesContainer.insertAdjacentHTML(
        'beforeend',
        `<div class="message ${isBridge ? "bridge" : ""}">
            <div class="message-img"></div>
            <div class="message-content">
                <div class="message-author">
                    ${xssSanitize(message.from)}
                </div>
                <div class="message-text">
                    ${
                        enrichText(
                            xssSanitize(message.message)
                        )
                    }
                </div>
            </div> <!-- message-content -->
        </div>`
    )
    // autoscroll
    messagesContainer.scrollTop = messagesContainer.scrollHeight
}

socket.on('message', (message: IrcMessage) => {
    console.log(message)
    let isBridge = false
    if (message.from === 'bridge') {
        const slibbers = message.message.split('>')
		message.from = slibbers[0].substring(1)
		message.message = slibbers.slice(1).join('>').substring(1)
		isBridge = true
    }
    renderMessage(message, isBridge)
})

document.querySelector('form')
    .addEventListener('submit', (event) => {
        event.preventDefault()
        const messageInp: HTMLInputElement = document.querySelector('#message-input')
        const message = messageInp.value
        if (!message) {
            return
        }
        messageInp.value = ""
        const ircMessage = {
            from: 'ws-client',
            message: message
        }
        // only render when we get the res from server
        // renderMessage(ircMessage)
        socket.emit('message', ircMessage)
    })

fetch(`${backendUrl}/messages`)
    .then(data => data.json())
    .then((messages: IrcMessage[]) => {
        console.log(messages)
        // clears the loading message
        messagesContainer.innerHTML = ""
        messages.forEach((message: IrcMessage) => {
            renderMessage(message)
        })
    })