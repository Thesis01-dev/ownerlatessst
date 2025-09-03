import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Image, Search, MoreVertical, Phone, Video } from "lucide-react";
import { auth } from '../../firebase'; 
import TopbarOwner from '../../scenes/global/TopbarOwner';
import SidebarOwner from '../../scenes/global/SidebarOwner';
import { useLocation } from "react-router-dom";

const Messages = ({ db, user }) => {
  const [contacts, setContacts] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
    
  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };
  

  // Load contacts (implement your Firebase logic here)
  useEffect(() => {
    if (!user) return;
    
    // TODO: Implement Firebase logic to fetch contacts
    // Example:
    // const fetchContacts = async () => {
    //   const contactsRef = collection(db, "contacts");
    //   const snapshot = await getDocs(contactsRef);
    //   const contactsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    //   setContacts(contactsData);
    // };
    // fetchContacts();
  }, [user]);

  // Load messages for active chat
  useEffect(() => {
    if (!activeChat?.id || !user) return;

    // TODO: Implement Firebase logic to fetch messages
    // Example:
    // const fetchMessages = async () => {
    //   const messagesRef = collection(db, "messages");
    //   const q = query(
    //     messagesRef,
    //     where("participants", "array-contains", user.uid),
    //     orderBy("timestamp", "asc")
    //   );
    //   const snapshot = await getDocs(q);
    //   const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    //   setMessages(messagesData);
    // };
    // fetchMessages();
  }, [activeChat, user]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (input.trim() === "" || !activeChat || !user) return;

    // TODO: Implement Firebase logic to send message
    /*
    try {
      await addDoc(collection(db, "messages"), {
        text: input,
        senderId: user.uid,
        receiverId: activeChat.id,
        participants: [user.uid, activeChat.id],
        timestamp: serverTimestamp(),
        type: "text"
      });
      setInput("");
    } catch (error) {
      console.error("Error sending message: ", error);
    }
    */
  };

  const sendImage = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChat || !user) return;

    // TODO: Implement Firebase Storage logic for image uploads
    /*
    try {
      const storageRef = ref(storage, `images/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const imageUrl = await getDownloadURL(uploadResult.ref);
      
      await addDoc(collection(db, "messages"), {
        text: imageUrl,
        senderId: user.uid,
        receiverId: activeChat.id,
        participants: [user.uid, activeChat.id],
        timestamp: serverTimestamp(),
        type: "image"
      });
    } catch (error) {
      console.error("Error sending image: ", error);
    }
    */
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Please log in</h3>
          <p className="text-gray-500">You need to be logged in to access messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarOwner onLogout={handleLogout} />

      <div className="flex flex-col flex-1">
        {/* Full width topbar */}
        <div className="h-16 bg-white shadow-sm border-b border-gray-200">
          <TopbarOwner />
        </div>

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Contacts sidebar */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            {/* Search bar */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Search conversations..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                />
              </div>
            </div>

            {/* Contacts List */}
            <div className="flex-1 overflow-y-auto">
              {filteredContacts.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No contacts found
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div 
                    key={contact.id} 
                    className={`flex items-center p-4 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 ${
                      activeChat?.id === contact.id 
                        ? "bg-blue-50 border-l-blue-500" 
                        : "border-l-transparent"
                    }`} 
                    onClick={() => setActiveChat(contact)}
                  >
                    <div className="relative">
                      <img 
                        src={contact.photoURL || "https://via.placeholder.com/40"} 
                        alt={contact.displayName} 
                        className="w-12 h-12 rounded-full object-cover" 
                      />
                      {contact.online && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {contact.displayName}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {contact.timestamp && formatTime(contact.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate mt-1">
                        {contact.lastMessage}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Window */}
          {activeChat ? (
            <div className="flex-1 flex flex-col">
              {/* Chat Header */}
              <div className="flex items-center justify-between bg-white p-4 border-b border-gray-200 shadow-sm">
                <div className="flex items-center">
                  <div className="relative">
                    <img 
                      src={activeChat.photoURL || "https://via.placeholder.com/40"} 
                      alt={activeChat.displayName} 
                      className="w-10 h-10 rounded-full object-cover" 
                    />
                    {activeChat.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  <div className="ml-3">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {activeChat.displayName}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {activeChat.online ? "Online" : "Last seen recently"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                    <Phone className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                    <Video className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-8">
                      No messages yet. Start the conversation!
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`flex items-end space-x-2 ${
                          msg.senderId === user.uid ? "justify-end" : "justify-start"
                        }`}
                      >
                        {msg.senderId !== user.uid && (
                          <img 
                            src={activeChat.photoURL || "https://via.placeholder.com/32"} 
                            alt={activeChat.displayName} 
                            className="w-8 h-8 rounded-full object-cover" 
                          />
                        )}
                        <div 
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                            msg.senderId === user.uid 
                              ? "bg-blue-500 text-white rounded-br-md" 
                              : "bg-white text-gray-900 rounded-bl-md shadow-sm"
                          }`}
                        >
                          {msg.type === "text" ? (
                            <p className="text-sm">{msg.text}</p>
                          ) : (
                            <img 
                              src={msg.text} 
                              alt="sent" 
                              className="max-w-full rounded-lg" 
                            />
                          )}
                          <p className={`text-xs mt-1 ${
                            msg.senderId === user.uid ? "text-blue-100" : "text-gray-500"
                          }`}>
                            {formatTime(msg.timestamp)}
                          </p>
                        </div>
                        {msg.senderId === user.uid && (
                          <img 
                            src={user.photoURL || "https://via.placeholder.com/32"} 
                            alt="You" 
                            className="w-8 h-8 rounded-full object-cover" 
                          />
                        )}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Message Input */}
              <div className="bg-white border-t border-gray-200 p-4">
                <div className="flex items-center space-x-3">
                  <label htmlFor="imageInput" className="cursor-pointer text-gray-500 hover:text-gray-700 transition-colors">
                    <Image className="w-5 h-5" />
                  </label>
                  <input 
                    type="file" 
                    id="imageInput" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={sendImage} 
                  />
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder="Type a message..."
                      onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                    />
                  </div>
                  <button 
                    onClick={sendMessage} 
                    disabled={!input.trim()}
                    className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No chat selected</h3>
                <p className="text-gray-500">Choose a conversation from the sidebar to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;