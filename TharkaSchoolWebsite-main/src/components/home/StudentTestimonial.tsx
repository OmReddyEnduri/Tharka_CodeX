import { useEffect, useState } from "react";
import { Quote, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";

const studentTestimonials = [
  {
    quote: "Ramanji Sir is an outstanding instructor who forces you to think rather than memorize. He uses puzzles to help students think clearly and reduce stress. His 'learn via WHY?' strategy made learning fun and engaging for me.",
    author: "Dharmik",
    college: "IIT Hyderabad",
    image: "/Image 1.jpeg", 
  },
  {
    quote: "I attended Ramanji Sir's program with no coding experience, and it gave me a great head start. He makes the course engaging by asking logical questions and demonstrating practical benefits. His emphasis on teaching 'what truly matters' is incredibly helpful.",
    author: "Veneeth",
    college: "IIT Hyderabad",
    image: "/Veneeth.jpeg", 
  },
  {
    quote: <>I learned algorithms and data structures from Ramanji Sir, whose knowledge made challenging subjects simple to comprehend. His real-world examples and focus on multiple solutions greatly enhanced my problem-solving skills. I was able to get an <strong className="text-foreground">internship at Google</strong> thanks largely to his guidance.</>,
    author: "Ritheesh",
    college: "IIT Ropar",
    image: "/Ritheesh.jpeg", 
  },
  {
    quote: "We enjoy how Sir instructs, starting each lesson with a puzzle to help us focus. He covers topics like Machine Learning, OS, and DSA in a clear, simple manner. He encourages engagement and ensures everyone is included, making the class interactive and entertaining.",
    author: "Harshith",
    college: "IIT Dhanbad",
    image: "/Harshith.jpeg", 
  },
  {
    quote: "I was initially skeptical, but joining was the right decision. All the programming knowledge I possess (C++, DSA, OS basics) is what I learned from Ramanji Sir. The clarity of his teaching was far superior to what I experienced in college.",
    author: "Pramod",
    college: "IIT Guwahati",
    image: "/Pramod.jpeg", 
  },
  {
    quote: "I admire his way of teaching using real-life examples, making concepts easier to understand. Whether it's DSA or OS, he teaches in a clear, engaging manner. He encourages participation, making the class interactive. His style helps us understand concepts better and remember them longer.",
    author: "Mahidhar",
    college: "IIT Hyderabad",
    image: "/Mahidhar.jpeg", 
  },
  {
    quote: "Attending Ramanji Sir's classes helped me a lot in my engineering college. I really like his way of thinking. Looking back, I feel I spent time learning things that weren't very useful in school. I believe it is best to learn coding from the beginning to achieve our dream jobs.",
    author: "Satwik",
    college: "IIT kharagpur",
    image: "/Satwik.jpeg", 
  },
  {
    quote: "I started learning coding with Sir, who explained everything well from the basics to DSA. He guided us through solving problems with clarity that even IIT professors didn't match. I really liked his teaching style, which made everything very easy to understand.",
    author: "Hrushikesh",
    college: "IIT Varanasi",
    image: "/Hrushikesh.jpeg", 
  },
  {
    quote: "Thanks to your classes, I've effectively improved my problem-solving skills, C++, and DSA knowledge. I am happy that this is proving helpful not just for my grades, but also for my internships and future plans.",
    author: "Phani",
    college: "IIT Roorkee",
    image: "/Phani.jpeg", 
  },
  {
    quote: "The DSA classes were very useful. I learned many new things, and topics I once found difficult felt very easy after your explanation. Overall, I felt I learned a lot from the classes.",
    author: "Sai Teja",
    college: "IIT Chennai",
    image: "/Sai Teja.jpeg", 
  }
];

export function StudentTestimonials() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) {
      return;
    }

    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  return (
    <section className="py-16 bg-muted/30">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-primary mb-4">
            Student Experiences
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Directly from students who have transformed their futures through our courses.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
           <Carousel setApi={setApi} className="w-full">
              <CarouselContent>
                {studentTestimonials.map((testimonial, index) => (
                  <CarouselItem key={index} className="basis-[85%] md:basis-1/2 lg:basis-1/3">
                    <div className="p-1 h-full">
                      <Card className="h-full border-highlight/20 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-6 flex flex-col h-full">
                          <Quote className="h-8 w-8 text-highlight/40 mb-4" />
                          <p className="text-muted-foreground mb-6 flex-grow italic leading-relaxed">
                            "{testimonial.quote}"
                          </p>
                          <div className="flex items-center gap-4 mt-auto pt-4 border-t border-border">
                            <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-primary/20 shrink-0">
                              <img 
                                src={testimonial.image} 
                                alt={testimonial.author} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <p className="font-semibold text-foreground text-sm">{testimonial.author}</p>
                              <p className="text-xs text-muted-foreground">{testimonial.college}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden md:flex" />
              <CarouselNext className="hidden md:flex" />
            </Carousel>
            <div className="flex justify-center gap-2 mt-4">
              {studentTestimonials.map((_, index) => (
                <button
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    index + 1 === current ? "bg-primary w-6" : "bg-primary/30 w-2"
                  }`}
                  onClick={() => api?.scrollTo(index)}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
        </div>
      </div>
    </section>
  );
}
