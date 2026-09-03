import { Card, CardContent } from "@/components/ui/card";

const videoFiles = [
  "document_6190393538329451068.mp4",
  "document_6190393538329451072.mp4",
  "document_6190393538329451064.mp4",
  "document_6190393538329451065.mp4",
  "document_6190393538329451066.mp4"
];

export function StudentVideos() {
  return (
    <section className="py-16 bg-background">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-primary mb-4">
            Video Testimonials
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Hear directly from our students about their journey.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {videoFiles.map((fileName, index) => (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="aspect-video bg-black/10">
                  <video 
                    className="w-full h-full object-cover" 
                    controls 
                    preload="metadata"
                  >
                    <source src={`/${fileName}`} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
